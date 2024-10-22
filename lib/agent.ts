import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import {
    streamObject,
    CoreAssistantMessage,
    CoreMessage,
    CoreTool,
    CoreToolMessage,
    CoreUserMessage,
    TextPart,
    ToolCallPart,
    ToolResultPart,
    LanguageModelUsage,
    LanguageModelV1,
} from 'ai'
import { cookies } from 'next/headers'
import { messageStore } from './messageStore'
import { getModelClient, LLMModel, LLMModelConfig } from './modelProviders'
import { generateCode } from './tools'
import { CSVAnalysis, Message, StreamChunk, Tool, ToolResult, ToolCall } from './types'
import { z } from 'zod'

const messageSchema = z.object({
    type: z.string(),
    content: z.string(),
    toolCalls: z.array(z.any()).optional(),
    toolResults: z.array(z.any()).optional(),
})


export class GruntyAgent {
    private model: LLMModel
    private role: string
    private roleDescription: string
    private config: LLMModelConfig
    private inputTokens: number = 0
    private outputTokens: number = 0
    private codeTokens: number = 0
    private totalTokens: number = 0

    constructor(
        model: LLMModel,
        role: string,
        roleDescription: string,
        config: LLMModelConfig
    ) {
        this.model = model
        this.role = role
        this.roleDescription = roleDescription
        this.config = config
    }

    private async fetchChatHistory(chatId: string): Promise<Message[]> {
        const supabase = createRouteHandlerClient({ cookies })
        const { data, error } = await supabase.rpc('get_chat_messages', {
            p_chat_id: chatId,
            p_limit: 50,
            p_offset: 0,
        })

        if (error) {
            console.error('Failed to fetch chat history:', error)
            return []
        }

        return data
    }

    async *chat(
        chatId: string,
        userId: string,
        latestMessage: string,
        tools: Tool[],
        temperature: number,
        maxTokens: number,
        csvAnalysis?: CSVAnalysis
    ): AsyncGenerator<StreamChunk> {
        const chatHistory = await this.fetchChatHistory(chatId)
        console.log('Chat History for chatId:', chatId, chatHistory)
        const userMessage: CoreUserMessage = {
            role: 'user',
            content: latestMessage,
        }

        const sanitizedMessages = this.prepareMessagesForAI(chatHistory)
        sanitizedMessages.push(userMessage)

        console.log('Sanitized Messages:', sanitizedMessages)

        const modelClient = getModelClient(this.model, this.config)

        const recordTokenUsage = ({
            promptTokens,
            completionTokens,
            totalTokens,
        }: LanguageModelUsage) => {
            console.log('Prompt tokens:', promptTokens);
            console.log('Completion tokens:', completionTokens);
            console.log('Total tokens:', totalTokens);
            this.totalTokens = totalTokens
        }

        let currentMessage: any = null
        let currentContentBlock: any = null
        let accumulatedJson = ''
        let accumulatedResponse = ''
        let generatedCode = ''
        let toolCalls: ToolCall<string, any>[] = []
        let toolResults: ToolResult<string, any, any>[] = []

        const streamResult = await streamObject({
            model: modelClient as LanguageModelV1,
            output: 'array',
            system: this.roleDescription,
            schema: messageSchema,
            messages: sanitizedMessages,
            maxTokens: maxTokens,
            onFinish: async () => {
                await streamResult.usage.then(recordTokenUsage);
                await this.storeMessage(
                    chatId,
                    userId,
                    latestMessage,
                    accumulatedResponse.trim(),
                    this.totalTokens,
                    toolCalls,
                    toolResults
                )
            }
        })

        let currentToolCall: ToolCall<string, any> | null = null

        for await (const events of streamResult.partialObjectStream) {
            for (const event of events) {
                // Handle text content
                if (event.type === 'text') {
                    accumulatedResponse += event.content;
                    yield event as StreamChunk;
                }

                // Handle tool calls
                else if (event.type === 'tool-call' && 'toolCallId' in event && 'toolName' in event && 'args' in event) {
                    const toolCallEvent = {
                        toolCallId: event.toolCallId as string,
                        toolName: event.toolName as string,
                        args: event.args as any
                    } as ToolCall<string, any>;
                    currentToolCall = toolCallEvent;

                    if (currentToolCall) {
                        toolCalls.push(currentToolCall);
                    }

                    // Special handling for Streamlit app generation
                    if (toolCallEvent.toolName === 'create_streamlit_app') {
                        try {
                            const codeQuery = `
                                ${toolCallEvent.args.query}
                                Use the following CSV analysis to inform your code:
                                ${JSON.stringify(csvAnalysis, null, 2)}
                            `;

                            const { generatedCode, codeTokenCount } = await generateCode(codeQuery);
                            this.codeTokens += codeTokenCount;

                            // Yield the generated code
                            yield {
                                type: 'generated_code',
                                content: generatedCode,
                            } as StreamChunk;

                            // Store tool result
                            toolResults.push({
                                toolCallId: toolCallEvent.toolCallId,
                                toolName: 'create_streamlit_app',
                                result: generatedCode,
                                args: {}
                            });
                        } catch (error) {
                            console.error('Error generating Streamlit code:', error);
                            yield {
                                type: 'error',
                                content: 'Error in code generation process'
                            } as StreamChunk;
                        }
                    }
                }

                // Handle tool results
                else if (event.type === 'tool-result' && 'toolCallId' in event && 'toolName' in event && 'result' in event) {
                    const toolResultEvent = {
                        toolCallId: event.toolCallId as string,
                        toolName: event.toolName as string,
                        result: event.result as any,
                        args: {}
                    } as ToolResult<string, any, any>;
                    toolResults.push(toolResultEvent);
                    yield event as StreamChunk;
                }
            }
        }

        currentMessage = null
        accumulatedResponse = ''
        generatedCode = ''
        toolCalls = []
        toolResults = []
    }

    private async storeMessage(
        chatId: string,
        userId: string,
        userMessage: string,
        assistantMessage: string,
        tokenCount: number,
        toolCalls: any,
        toolResults: any
    ) {
        const supabase = createRouteHandlerClient({ cookies })
        const { data, error } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                user_id: userId,
                user_message: userMessage,
                assistant_message: assistantMessage,
                tool_calls: toolCalls,
                tool_results: toolResults,
                token_count: tokenCount,
            })
            .select()

        if (error) {
            console.error(
                'Failed to store message:',
                error.message,
                error.details,
                error.hint
            )
            throw error
        } else {
            console.log('Message stored successfully with ID:', data)

            messageStore.setMessageStored(chatId)
        }
    }

    private prepareMessagesForAI(messages: Message[]): CoreMessage[] {
        const sanitizedMessages: CoreMessage[] = []

        for (const message of messages) {
            // Add user message
            const userMessage: CoreUserMessage = {
                role: 'user',
                content: message.user_message,
            }
            sanitizedMessages.push(userMessage)

            // Initialize assistant message
            const assistantContentParts: Array<TextPart | ToolCallPart> = []

            // Add text content
            if (message.assistant_message) {
                assistantContentParts.push({
                    type: 'text',
                    text: message.assistant_message,
                } as TextPart)
            }

            // Add tool calls if they exist
            if (message.tool_calls && typeof message.tool_calls === 'object') {
                const toolCalls = message.tool_calls as Record<string, Record<string, any>>
                for (const [id, callData] of Object.entries(toolCalls)) {
                    if (callData && 'name' in callData && 'parameters' in callData) {
                        assistantContentParts.push({
                            type: 'tool-call',
                            toolCallId: id,
                            toolName: callData.name as string,
                            args: callData.parameters,
                        } as ToolCallPart)
                    }
                }
            }

            // Add tool results if they exist
            if (message.tool_results && typeof message.tool_results === 'object') {
                const toolResults = message.tool_results as Record<string, { name: string, result: any }>
                for (const [id, resultData] of Object.entries(toolResults)) {
                    if (resultData && 'result' in resultData && 'name' in resultData) {
                        const toolMessage: CoreToolMessage = {
                            role: 'tool',
                            content: [
                                {
                                    type: 'tool-result',
                                    toolCallId: id,
                                    toolName: resultData.name,
                                    result: resultData.result,
                                    isError: false,
                                } as ToolResultPart,
                            ],
                        }
                        sanitizedMessages.push(toolMessage)
                    }
                }
            }

            // Add assistant message if there are any content parts
            if (assistantContentParts.length > 0) {
                const assistantMessage: CoreAssistantMessage = {
                    role: 'assistant',
                    content: assistantContentParts,
                }
                sanitizedMessages.push(assistantMessage)
            }
        }

        return sanitizedMessages
    }
}

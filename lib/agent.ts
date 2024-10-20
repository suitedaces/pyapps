import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import {
    generateText,
    CoreAssistantMessage,
    CoreMessage,
    CoreTool,
    CoreToolMessage,
    CoreUserMessage,
    TextPart,
    ToolCallPart,
    ToolResultPart,
    streamText,
} from 'ai'
import { cookies } from 'next/headers'
import { messageStore } from './messageStore'
import { getModelClient, LLMModel, LLMModelConfig } from './modelProviders'
import { generateCode } from './tools'
import { CSVAnalysis, Message, StreamChunk, Tool, ToolResult } from './types'

export class GruntyAgent {
    private model: LLMModel
    private role: string
    private roleDescription: string
    private inputTokens: number
    private outputTokens: number
    private codeTokens: number
    private config: LLMModelConfig

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
        this.inputTokens = 0
        this.outputTokens = 0
        this.codeTokens = 0
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

        const toolsRecord: Record<string, CoreTool<any, any>> = tools.reduce(
            (acc, tool) => {
                acc[tool.name] = tool // Map tool name to tool
                return acc
            },
            {} as Record<string, CoreTool<any, any>>
        )

        const modelClient = getModelClient(this.model, this.config)

        let currentMessage: any = null
        let currentContentBlock: any = null
        let accumulatedJson = ''
        let accumulatedResponse = ''
        let generatedCode = ''
        let toolCalls: ToolCallPart[] | null = null
        let toolResults: ToolResult[] | null = null
        let stepResults: StreamChunk[] = []

        const stream = await streamText({
            model: modelClient,
            system: this.roleDescription,
            messages: sanitizedMessages,
            maxTokens: maxTokens,
            maxSteps: 10,
            tools: toolsRecord,
            onStepFinish: async ({
                text,
                toolCalls: stepToolCalls,
                toolResults: stepToolResults,
            }) => {
                if (!currentMessage) {
                    currentMessage = {
                        content: [],
                    }
                }

                // step-wise processing, handling both text and tool usage
                if (text) {
                    accumulatedResponse += text
                    currentMessage.content.push({ type: 'text', text })
                }

                // Handle tool calls
                if (stepToolCalls && stepToolCalls.length > 0) {
                    toolCalls = toolCalls || []
                    toolCalls.push(...stepToolCalls)
                }

                // Handle tool results
                if (stepToolResults && stepToolResults.length > 0) {
                    toolResults = toolResults || []
                    toolResults.push(...stepToolResults)
                }

                stepResults.push({
                    type: 'text_chunk',
                    content: accumulatedResponse.trim(),
                } as StreamChunk)

                if (toolCalls) {
                    for (const toolCall of toolCalls) {
                        if (toolCall.toolName === 'create_streamlit_app') {
                            try {
                                const toolInput = JSON.parse(accumulatedJson)
                                const codeQuery = `
                                    ${toolInput.query}
                                    Use the following CSV analysis to inform your code:
                                    ${JSON.stringify(csvAnalysis, null, 2)}
                                `
                                const { generatedCode, codeTokenCount } =
                                    await generateCode(codeQuery)
                                this.codeTokens += codeTokenCount

                                stepResults.push({
                                    type: 'generated_code',
                                    content: generatedCode,
                                } as StreamChunk)

                                toolResults = toolResults || []
                                toolResults.push({
                                    name: 'create_streamlit_app',
                                    result: generatedCode,
                                })
                            } catch (error) {
                                console.error(
                                    'Error parsing JSON or generating Streamlit code:',
                                    error
                                )
                                stepResults.push({
                                    type: 'error',
                                    content: 'Error in code generation process',
                                } as StreamChunk)
                            }
                        }
                    }
                }
            },
        })

        // Now use a loop to yield the accumulated results in stepResults
        for (const result of stepResults) {
            yield result
            return stream.toTextStreamResponse()
        }

        console.log('Storing Message for chatId:', chatId)
        const totalTokenCount =
            this.outputTokens + this.codeTokens + this.inputTokens
        console.log(
            'Total Token Count (output, code, input):',
            this.outputTokens,
            this.codeTokens,
            this.inputTokens
        )

        await this.storeMessage(
            chatId,
            userId,
            latestMessage,
            accumulatedResponse.trim(),
            totalTokenCount,
            toolCalls,
            toolResults
        )

        // Reset variables
        currentMessage = null
        accumulatedResponse = ''
        generatedCode = ''
        toolCalls = null
        toolResults = null
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

            // Add assistant message
            const assistantContentParts: Array<TextPart | ToolCallPart> = []

            // Add text content
            if (message.assistant_message) {
                assistantContentParts.push({
                    type: 'text',
                    text: message.assistant_message,
                } as TextPart)
            }

            // Add tool calls if they exist
            if (
                message.tool_calls &&
                typeof message.tool_calls === 'object' &&
                !Array.isArray(message.tool_calls)
            ) {
                const toolCalls = message.tool_calls as Record<
                    string,
                    Record<string, any>
                >
                for (const [id, callData] of Object.entries(toolCalls)) {
                    if (
                        typeof callData === 'object' &&
                        callData !== null &&
                        'name' in callData &&
                        'parameters' in callData
                    ) {
                        assistantContentParts.push({
                            type: 'tool-call',
                            toolCallId: id,
                            toolName: callData.name as string,
                            args: callData.parameters,
                        } as ToolCallPart)
                    }
                }
            }

            if (assistantContentParts.length > 0) {
                const assistantMessage: CoreAssistantMessage = {
                    role: 'assistant',
                    content: assistantContentParts,
                }
                sanitizedMessages.push(assistantMessage)
            }

            // Add tool results if they exist
            if (
                message.tool_results &&
                typeof message.tool_results === 'object' &&
                !Array.isArray(message.tool_results)
            ) {
                const toolResults = message.tool_results as Record<
                    string,
                    {
                        name: string
                        result: any
                    }
                >
                for (const [id, resultData] of Object.entries(toolResults)) {
                    if (
                        typeof resultData === 'object' &&
                        resultData !== null &&
                        'result' in resultData &&
                        'name' in resultData
                    ) {
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
        }

        return sanitizedMessages
    }
}

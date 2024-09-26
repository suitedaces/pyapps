import { Anthropic } from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { generateCode } from './tools'
import {
    CSVAnalysis,
    Message,
    StreamChunk,
    Tool,
    ToolCall,
    ToolResult,
} from './types'
import { messageStore } from './messageStore'

export class GruntyAgent {
    private client: Anthropic
    private model: string
    private role: string
    private roleDescription: string
    private inputTokens: number
    private outputTokens: number
    private codeTokens: number

    constructor(
        client: Anthropic,
        model: string,
        role: string,
        roleDescription: string
    ) {
        this.client = client
        this.model = model
        this.role = role
        this.roleDescription = roleDescription
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
        const userMessage: any = {
            role: 'user',
            content: latestMessage,
        }

        const sanitizedMessages =
            this.prepareMessagesForAnthropicAPI(chatHistory)
        sanitizedMessages.push(userMessage)

        console.log('Sanitized Messages:', sanitizedMessages)

        const stream = await this.client.messages.stream({
            model: this.model,
            system: this.roleDescription,
            messages: sanitizedMessages,
            max_tokens: maxTokens,
            tools,
        })

        let currentMessage: any = null
        let currentContentBlock: any = null
        let accumulatedJson = ''
        let accumulatedResponse = ''
        let generatedCode = ''
        let toolCalls: ToolCall[] | null = null
        let toolResults: ToolResult[] | null = null

        for await (const event of stream) {
            yield event as StreamChunk
            if (event.type === 'message_start') {
                currentMessage = event.message
                if (event.message.usage) {
                    this.inputTokens = event.message.usage.input_tokens
                }
            } else if (event.type === 'content_block_start') {
                currentContentBlock = event.content_block
                accumulatedJson = ''
            } else if (event.type === 'content_block_delta') {
                if (
                    currentContentBlock.type === 'text' &&
                    event.delta.type === 'text_delta'
                ) {
                    currentContentBlock.text =
                        (currentContentBlock.text || '') + event.delta.text
                    accumulatedResponse += event.delta.text
                } else if (
                    currentContentBlock.type === 'tool_use' &&
                    event.delta.type === 'input_json_delta'
                ) {
                    accumulatedJson += event.delta.partial_json
                }
            } else if (event.type === 'content_block_stop') {
                if (currentContentBlock.type === 'tool_use') {
                    currentContentBlock.input = accumulatedJson
                    currentMessage.content.push(currentContentBlock)
                    toolCalls = toolCalls || []
                    toolCalls.push(currentContentBlock)
                    if (currentContentBlock.name === 'create_streamlit_app') {
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

                            yield {
                                type: 'generated_code',
                                content: generatedCode,
                            } as unknown as StreamChunk

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
                            yield {
                                type: 'error',
                                content: 'Error in code generation process',
                            } as unknown as StreamChunk
                        }
                    }
                }
                currentContentBlock = null
            } else if (event.type === 'message_delta') {
                Object.assign(currentMessage, event.delta)
                if (event.usage) {
                    this.outputTokens = event.usage.output_tokens
                }
            } else if (event.type === 'message_stop') {
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

                currentMessage = null
                accumulatedResponse = ''
                generatedCode = ''
                toolCalls = null
                toolResults = null
            }
        }
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

    private prepareMessagesForAnthropicAPI(
        messages: Message[]
    ): Anthropic.Messages.MessageParam[] {
        const sanitizedMessages: Anthropic.Messages.MessageParam[] = []

        for (const message of messages) {
            // Add user message
            sanitizedMessages.push({
                role: 'user',
                content: message.user_message,
            })

            // Add assistant message
            const assistantMessage: Anthropic.Messages.MessageParam = {
                role: 'assistant',
                content: [],
            }

            // Add text content
            if (message.assistant_message) {
                ;(
                    assistantMessage.content as Anthropic.Messages.ContentBlock[]
                ).push({
                    type: 'text',
                    text: message.assistant_message,
                })
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
                        ;(
                            assistantMessage.content as Anthropic.Messages.ContentBlock[]
                        ).push({
                            type: 'tool_use',
                            id: id,
                            name: callData.name as string,
                            input: callData.parameters as Record<
                                string,
                                Record<string, any>
                            >,
                        })
                    }
                }
            }

            sanitizedMessages.push(assistantMessage)

            // Add tool results if they exist
            if (
                message.tool_results &&
                typeof message.tool_results === 'object' &&
                !Array.isArray(message.tool_results)
            ) {
                const toolResults = message.tool_results as Record<
                    string,
                    Record<string, any>
                >
                for (const [id, resultData] of Object.entries(toolResults)) {
                    if (
                        typeof resultData === 'object' &&
                        resultData !== null &&
                        'result' in resultData
                    ) {
                        sanitizedMessages.push({
                            role: 'user',
                            content: [
                                {
                                    type: 'tool_result',
                                    tool_use_id: id,
                                    content: resultData.result as string,
                                },
                            ],
                        })
                    }
                }
            }
        }

        return sanitizedMessages
    }
}

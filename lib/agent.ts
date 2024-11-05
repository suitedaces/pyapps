import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { CoreMessage as VercelMessage } from 'ai'
import { cookies } from 'next/headers'
import { messageStore } from './messageStore'
import { generateCode } from './tools'
import { streamText, LanguageModelV1, CoreMessage, CoreUserMessage, CoreAssistantMessage, CoreToolMessage, TextPart, ToolCallPart, ToolResultPart } from 'ai'
import {
    ModelProvider,
    Tool,
    LLMModelConfig,
    ToolInvocation as GruntyToolInvocation
} from './types'
import { encode } from 'gpt-tokenizer'

export class GruntyAgent {
    private model: ModelProvider
    private role: string
    private roleDescription: string
    private config: LLMModelConfig
    private sanitizedMessages: CoreMessage[] = []

    constructor(
        modelClient: ModelProvider,
        role: string,
        roleDescription: string,
        config: LLMModelConfig
    ) {
        this.model = modelClient
        this.role = role
        this.roleDescription = roleDescription
        this.config = config
    }

    async streamResponse(
        chatId: string,
        userId: string,
        messages: CoreMessage[],
        tools: Tool[],
        csvAnalysis?: any
    ) {
        console.log('🚀 Starting stream response in GruntyAgent', {
            chatId,
            userId,
            messagesCount: messages.length
        })

        // Reset sanitizedMessages for each new conversation turn
        this.sanitizedMessages = []

        // Add system message
        this.sanitizedMessages.push({
            role: 'system',
            content: this.roleDescription
        })
        console.log('➕ Added system message to sanitizedMessages')

        // Fetch complete conversation history from database
        const supabase = createRouteHandlerClient({ cookies })
        console.log('📥 Fetching message history for chat:', chatId)
        const { data: messageHistory, error: historyError } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

        if (historyError) {
            console.error('❌ Error fetching message history:', historyError)
        }

        // Add messages in chronological order
        if (messageHistory) {
            console.log('📚 Processing message history:', {
                historyLength: messageHistory.length,
                firstMessage: messageHistory[0]?.created_at,
                lastMessage: messageHistory[messageHistory.length - 1]?.created_at
            })

            for (const msg of messageHistory) {
                if (msg.user_message) {
                    this.sanitizedMessages.push({
                        role: 'user',
                        content: msg.user_message
                    })
                    console.log('➕ Added historical user message:', {
                        timestamp: msg.created_at,
                        contentPreview: msg.user_message.substring(0, 50) + '...'
                    })
                }
                if (msg.assistant_message) {
                    this.sanitizedMessages.push({
                        role: 'assistant',
                        content: msg.assistant_message
                    })
                    console.log('➕ Added historical assistant message:', {
                        timestamp: msg.created_at,
                        contentPreview: msg.assistant_message.substring(0, 50) + '...'
                    })
                }
            }
        }

        // Add the latest user message if it's not in the database yet
        const latestUserMessage = messages[messages.length - 1]
        if (latestUserMessage.role === 'user') {
            this.sanitizedMessages.push({
                role: 'user',
                content: latestUserMessage.content
            })
            console.log('➕ Added latest user message:', {
                content: typeof latestUserMessage.content === 'string'
                    ? latestUserMessage.content.substring(0, 50) + '...'
                    : 'Complex content structure'
            })
        }

        console.log('📨 Final conversation state:', {
            messageCount: this.sanitizedMessages.length,
            roles: this.sanitizedMessages.map(m => m.role),
            lastMessage: this.sanitizedMessages[this.sanitizedMessages.length - 1]
        })

        const encoder = new TextEncoder()
        const stream = new TransformStream()
        const writer = stream.writable.getWriter()

        const streamProcess = async () => {
            try {
                let collectedContent = ''
                console.log('🔄 Starting stream process')

                // Format tools
                const formattedTools = tools?.reduce((acc, tool) => {
                    acc[tool.toolName] = {
                        description: tool.description,
                        parameters: tool.parameters,
                        execute: async (args: any) => {
                            console.log('🔧 Executing tool:', {
                                toolName: tool.toolName,
                                args
                            })
                            if (tool.toolName === 'create_streamlit_app') {
                                const { generatedCode } = await generateCode(
                                    `${args.query}\nCSV Analysis: ${JSON.stringify(csvAnalysis)}`
                                )
                                return generatedCode
                            }
                            return undefined
                        }
                    }
                    return acc
                }, {} as Record<string, any>)

                console.log('🛠️ Formatted tools:', Object.keys(formattedTools))

                // Stream setup
                console.log('📡 Initializing stream with model:', this.config.model)
                const { textStream, fullStream } = await streamText({
                    model: this.model as unknown as LanguageModelV1,
                    messages: this.sanitizedMessages,
                    tools: formattedTools,
                    temperature: this.config.temperature || 0.7,
                    maxTokens: this.config.maxTokens || 4096
                })

                // Handle text stream
                console.log('📝 Starting text stream processing')
                for await (const chunk of textStream) {
                    collectedContent += chunk
                    const text = `0:${JSON.stringify(chunk)}\n`
                    writer.write(encoder.encode(text))
                    console.log('📤 Streamed chunk:', chunk.substring(0, 50) + '...')
                }

                // Handle full stream
                console.log('🔄 Processing full stream')
                for await (const step of fullStream) {
                    console.log('📦 Stream step:', { type: step.type })

                    if (step.type === 'tool-call') {
                        console.log('🔧 Processing tool call:', {
                            toolName: step.toolName,
                            toolCallId: step.toolCallId
                        })

                        const toolCallData = `9:${JSON.stringify({
                            toolCallId: step.toolCallId,
                            toolName: step.toolName,
                            args: step.args
                        })}\n`
                        writer.write(encoder.encode(toolCallData))

                        if (step.toolName === 'create_streamlit_app') {
                            console.log('🎨 Generating Streamlit code')
                            const { generatedCode } = await generateCode(
                                `${step.args.query}\nCSV Analysis: ${JSON.stringify(csvAnalysis)}`
                            )

                            console.log('💾 Storing tool interaction')
                            await this.storeMessage(chatId, userId, {
                                user_message: '',
                                assistant_message: generatedCode,
                                tool_calls: [{
                                    id: step.toolCallId,
                                    name: step.toolName,
                                    parameters: step.args
                                }],
                                tool_results: [{
                                    id: step.toolCallId,
                                    name: step.toolName,
                                    content: generatedCode
                                }]
                            })

                            const toolResultData = `a:${JSON.stringify({
                                toolCallId: step.toolCallId,
                                result: generatedCode
                            })}\n`
                            writer.write(encoder.encode(toolResultData))
                            console.log('✅ Tool execution complete')
                        }
                    } else if (step.type === 'finish') {
                        console.log('🏁 Stream finished, storing conversation')
                        if (collectedContent) {
                            const latestUserMessage = this.sanitizedMessages
                                .filter(msg => msg.role === 'user')
                                .pop()

                            console.log('💾 Storing final message pair:', {
                                userMessage: typeof latestUserMessage?.content === 'string'
                                    ? latestUserMessage.content.substring(0, 50) + '...'
                                    : 'No user message',
                                assistantMessage: collectedContent.substring(0, 50) + '...'
                            })

                            await this.storeMessage(chatId, userId, {
                                user_message: typeof latestUserMessage?.content === 'string'
                                    ? latestUserMessage.content
                                    : '',
                                assistant_message: collectedContent,
                                tool_calls: [],
                                tool_results: []
                            })
                        }

                        const finishData = `d:${JSON.stringify({
                            finishReason: 'stop',
                            usage: step.usage || { promptTokens: 0, completionTokens: 0 }
                        })}\n`
                        writer.write(encoder.encode(finishData))
                        console.log('✅ Finish message sent')
                    }
                }

            } catch (error) {
                console.error('❌ Error in stream process:', error)
                const errorData = `3:${JSON.stringify(String(error))}\n`
                writer.write(encoder.encode(errorData))
            } finally {
                console.log('👋 Closing stream writer')
                writer.close()
            }
        }

        streamProcess()

        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'x-vercel-ai-data-stream': 'v1'
            },
        })
    }

    private calculateTokenCount(text: string): number {
        return encode(text).length
    }

    private async storeMessage(
        chatId: string,
        userId: string,
        message: {
            user_message: string
            assistant_message: string
            tool_calls: any[]
            tool_results: any[]
        }
    ) {
        console.log('💾 Attempting to store message:', {
            chatId,
            userId,
            messagePreview: {
                user: message.user_message.substring(0, 50) + '...',
                assistant: message.assistant_message.substring(0, 50) + '...',
                toolCalls: message.tool_calls.length,
                toolResults: message.tool_results.length
            }
        })

        const supabase = createRouteHandlerClient({ cookies })

        try {
            const userTokens = this.calculateTokenCount(message.user_message)
            const assistantTokens = this.calculateTokenCount(message.assistant_message)
            const toolCallTokens = message.tool_calls?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_calls))
                : 0
            const toolResultTokens = message.tool_results?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_results))
                : 0

            const totalTokens = userTokens + assistantTokens + toolCallTokens + toolResultTokens

            console.log('🔢 Token counts:', {
                user: userTokens,
                assistant: assistantTokens,
                toolCalls: toolCallTokens,
                toolResults: toolResultTokens,
                total: totalTokens
            })

            const messageData = {
                chat_id: chatId,
                user_id: userId,
                user_message: message.user_message,
                assistant_message: message.assistant_message,
                tool_calls: message.tool_calls.length > 0 ? message.tool_calls : null,
                tool_results: message.tool_results.length > 0 ? message.tool_results : null,
                created_at: new Date().toISOString(),
                token_count: totalTokens
            }

            const { data, error } = await supabase
                .from('messages')
                .insert(messageData)
                .select()

            if (error) {
                console.error('❌ Failed to store message:', error)
                throw error
            }

            console.log('✅ Message stored successfully:', {
                messageId: data[0]?.id,
                timestamp: data[0]?.created_at
            })
            return data
        } catch (error) {
            console.error('❌ Error in storeMessage:', error)
            throw error
        }
    }
}

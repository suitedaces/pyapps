import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { CoreMessage, LanguageModelV1, streamText } from 'ai'
import { encode } from 'gpt-tokenizer'
import { cookies } from 'next/headers'
import { createVersion } from './supabase'
import { getTools, getTool } from './tools/index'
import { LLMModelConfig, ModelProvider, Tool } from './types'
import { completeToolStream, updateToolDelta, generate } from './actions';

interface FileContext {
    fileName: string
    fileType: string
    content?: string
    analysis?: any
}

// Main agent class that handles chat streaming and tool execution
export class GruntyAgent {
    private model: ModelProvider
    private role: string
    private roleDescription: string
    private config: LLMModelConfig
    private sanitizedMessages: CoreMessage[] = []
    private fileContext?: FileContext

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

    // Main method to handle streaming responses and tool execution
    async streamResponse(
        chatId: string,
        userId: string,
        messages: CoreMessage[],
        tools: Tool[],
        fileContext?: FileContext
    ) {
        this.fileContext = fileContext
        this.sanitizedMessages = []

        // Add system message with file context if available
        const systemMessage = fileContext
            ? `${this.roleDescription}\n\nYou are working with a ${fileContext.fileType.toUpperCase()} file named "${fileContext.fileName}".`
            : this.roleDescription

        this.sanitizedMessages.push({
            role: 'system',
            content: systemMessage,
        })

        // Process message history
        await this.processMessageHistory(chatId)

        // Add the latest user message
        const latestUserMessage = messages[messages.length - 1]
        if (latestUserMessage.role === 'user') {
            this.sanitizedMessages.push({
                role: 'user',
                content: latestUserMessage.content,
            })
        }

        // Set up streaming
        const encoder = new TextEncoder()
        const stream = new TransformStream()
        const writer = stream.writable.getWriter()

        // Start streaming process
        this.handleStreamProcess(writer, encoder, tools, chatId, userId)

        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
                'x-vercel-ai-data-stream': 'v1',
                'x-chat-id': chatId,
            },
        })
    }

    private async handleStreamProcess(
        writer: WritableStreamDefaultWriter,
        encoder: TextEncoder,
        tools: Tool[],
        chatId: string,
        userId: string
    ) {
        try {
            let collectedContent = ''
            let toolCalls: any[] = []
            let toolResults: any[] = []
            console.log('🚀 Starting stream process')

            // Fix: Convert tools array to record format
            const formattedTools = tools.reduce((acc, tool) => {
                acc[tool.toolName] = {
                    name: tool.toolName,
                    description: tool.description,
                    parameters: tool.schema
                }
                return acc
            }, {} as Record<string, { name: string; description: string; parameters: any }>)

            console.log('🛠️ Formatted tools:', {
                toolCount: Object.keys(formattedTools).length,
                tools: Object.keys(formattedTools)
            })

            // Start the stream
            const { textStream, fullStream } = await streamText({
                model: this.model as unknown as LanguageModelV1,
                messages: this.sanitizedMessages,
                tools: formattedTools,
                temperature: this.config.temperature || 0.5,
                maxTokens: this.config.maxTokens || 4096,
                experimental_toolCallStreaming: true,
            })

            // Process text stream
            for await (const chunk of textStream) {
                console.log('📝 Received text chunk:', { chunk })
                const textPart = `0:${JSON.stringify(chunk)}\n\n`
                await writer.write(encoder.encode(textPart))
                collectedContent += chunk
            }

            console.log('📝 Assistant message complete:', {
                contentLength: collectedContent.length,
                preview: collectedContent.substring(0, 100) + '...',
            })

            // Process tool calls
            for await (const step of fullStream) {
                if (step.type === 'tool-call') {
                    const { toolCallId, toolName, args } = step
                    console.log('🛠️ Tool call initiated:', { toolCallId, toolName })

                    const tool = tools.find(t => t.toolName === toolName)
                    if (!tool) {
                        console.error(`❌ Tool ${toolName} not found`)
                        await writer.write(encoder.encode(`e:${JSON.stringify({ toolCallId, error: `Tool ${toolName} not found` })}\n\n`))
                        continue
                    }

                    try {
                        console.log('🛠️ Starting tool execution:', { toolName, args })

                        // 1. Send tool call start
                        const startMessage = {
                            toolCallId,
                            toolName
                        }
                        console.log('📤 Sending tool start:', startMessage)
                        await writer.write(encoder.encode(`b:${JSON.stringify(startMessage)}\n\n`))

                        // 2. Send tool call delta - Make sure args is properly stringified
                        const deltaMessage = {
                            toolCallId,
                            argsTextDelta: typeof args === 'string' ? args : JSON.stringify(args)
                        }
                        console.log('📤 Sending tool delta:', deltaMessage)
                        await writer.write(encoder.encode(`c:${JSON.stringify(deltaMessage)}\n\n`))

                        const result = await Promise.race([
                            tool.execute(args, {
                                toolCallId,
                                messages: this.sanitizedMessages,
                                fileContext: this.fileContext
                            }),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Tool execution timeout')), 30000)
                            )
                        ])

                        // 3. Send tool result
                        const resultMessage = {
                            toolCallId,
                            result: typeof result === 'string' ? result : JSON.stringify(result)
                        }
                        console.log('📤 Sending tool result:', resultMessage)
                        await writer.write(encoder.encode(`a:${JSON.stringify(resultMessage)}\n\n`))

                        // 4. Fix: Send complete tool call with required properties
                        const toolCallMessage = {
                            toolCallId,
                            toolName,
                            args: typeof args === 'object' ? args : JSON.parse(args) // Ensure args is an object
                        }
                        console.log('📤 Sending tool call:', toolCallMessage)
                        await writer.write(encoder.encode(`9:${JSON.stringify(toolCallMessage)}\n\n`))
                    } catch (error) {
                        console.error('❌ Tool execution error:', error)
                        await writer.write(encoder.encode(`e:${JSON.stringify({
                            toolCallId,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        })}\n\n`))
                    }
                }
            }

            // Fix: Send proper finish message with required properties
            const finishMessage = {
                finishReason: 'stop',
                usage: {
                    promptTokens: this.calculateTokenCount(this.sanitizedMessages.map(m => m.content).join('')),
                    completionTokens: this.calculateTokenCount(collectedContent)
                }
            }
            console.log('📤 Sending finish message:', finishMessage)
            await writer.write(encoder.encode(`d:${JSON.stringify(finishMessage)}\n\n`))
            await writer.close()

            // Store the complete message
            if (collectedContent) {
                const latestUserMessage = this.sanitizedMessages
                    .filter((msg) => msg.role === 'user')
                    .pop()

                // Handle different content types according to Vercel's protocol
                const getUserMessageContent = (message: any): string => {
                    if (!message?.content) return ''

                    if (typeof message.content === 'string') {
                        return message.content
                    }

                    if (Array.isArray(message.content)) {
                        return message.content
                            .map((part: { type: string; text: any }) => {
                                if (typeof part === 'string') return part
                                if ('type' in part && part.type === 'text') {
                                    return part.text
                                }
                                return ''
                            })
                            .filter(Boolean)
                            .join(' ')
                    }

                    return ''
                }

                const userMessageContent = getUserMessageContent(latestUserMessage)

                console.log('📝 Processing user message:', {
                    originalContent: latestUserMessage?.content,
                    processedContent: userMessageContent,
                })

                await this.storeMessage(chatId, userId, {
                    user_message: userMessageContent,
                    assistant_message: collectedContent,
                    tool_calls: toolCalls,
                    tool_results: toolResults,
                })
            }
        } catch (error) {
            console.error('❌ Stream processing failed:', error)
            await writer.abort(error)
            throw error
        }
    }

    private async processMessageHistory(chatId: string): Promise<void> {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: messageHistory, error: historyError } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

        if (historyError) {
            console.error('❌ Error fetching message history:', historyError)
            return
        }

        if (messageHistory) {
            messageHistory.forEach((msg) => {
                if (msg.user_message) {
                    this.sanitizedMessages.push({
                        role: 'user',
                        content: msg.user_message,
                    })
                }
                if (msg.assistant_message) {
                    this.sanitizedMessages.push({
                        role: 'assistant',
                        content: msg.assistant_message,
                    })
                }
            })
        }
    }

    private calculateTokenCount(text: string): number {
        return encode(text).length
    }

    private async storeMessage(
        chatId: string,
        userId: string,
        message: {
            user_message: string | { content: string }
            assistant_message: string
            tool_calls: any[]
            tool_results: any[]
        }
    ): Promise<void> {
        const supabase = createRouteHandlerClient({ cookies })

        try {
            // Calculate token counts
            const userMessageContent =
                typeof message.user_message === 'string'
                    ? message.user_message
                    : message.user_message.content

            const userTokens = this.calculateTokenCount(userMessageContent)
            const assistantTokens = this.calculateTokenCount(
                message.assistant_message
            )
            const toolCallTokens = message.tool_calls?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_calls))
                : 0
            const toolResultTokens = message.tool_results?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_results))
                : 0

            const totalTokens =
                userTokens + assistantTokens + toolCallTokens + toolResultTokens

            console.log('🔢 Token counts:', {
                user: userTokens,
                assistant: assistantTokens,
                toolCalls: toolCallTokens,
                toolResults: toolResultTokens,
                total: totalTokens,
            })

            const messageData = {
                chat_id: chatId,
                user_id: userId,
                user_message: message.user_message,
                assistant_message: message.assistant_message,
                tool_calls:
                    message.tool_calls.length > 0 ? message.tool_calls : null,
                tool_results:
                    message.tool_results.length > 0
                        ? message.tool_results
                        : null,
                created_at: new Date().toISOString(),
                token_count: totalTokens,
            }

            const { error } = await supabase.from('messages').insert(messageData)

            if (error) {
                console.error('Failed to store message:', error)
                throw error
            }

            console.log('✅ Message stored successfully:', {
                chatId,
                userId,
                tokenCount: totalTokens,
            })
        } catch (error) {
            console.error('Error in storeMessage:', error)
            throw error
        }
    }
}

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { CoreMessage as VercelMessage } from 'ai'
import { cookies } from 'next/headers'
import { messageStore } from './messageStore'
import { generateCode } from './tools'
import { streamText, LanguageModelV1, CoreMessage } from 'ai'
import {
    ModelProvider,
    Tool,
    LLMModelConfig,
    ToolInvocation as GruntyToolInvocation
} from './types'
import { encode } from 'gpt-tokenizer'

interface FileContext {
    fileName: string;
    fileType: string;
    content?: string;
    analysis?: any;
}

// AI Agent that handles message streaming, tool execution, and conversation management
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
            content: systemMessage
        })

        // Fetch complete conversation history
        const supabase = createRouteHandlerClient({ cookies })
        const { data: messageHistory, error: historyError } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

        if (historyError) {
            console.error('❌ Error fetching message history:', historyError)
        }

        // Process message history
        if (messageHistory) {
            this.processMessageHistory(messageHistory)
        }

        // Add the latest user message
        const latestUserMessage = messages[messages.length - 1]
        if (latestUserMessage.role === 'user') {
            this.sanitizedMessages.push({
                role: 'user',
                content: latestUserMessage.content
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
                'Connection': 'keep-alive',
                'x-vercel-ai-data-stream': 'v1',
                'x-chat-id': chatId
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

            // Format tools with file context
            const formattedTools = this.formatTools(tools)

            // Initialize stream
            const { textStream, fullStream } = await streamText({
                model: this.model as unknown as LanguageModelV1,
                messages: this.sanitizedMessages,
                tools: formattedTools,
                temperature: this.config.temperature || 0.7,
                maxTokens: this.config.maxTokens || 4096,
                experimental_toolCallStreaming: true,
            })

            // Process text stream
            for await (const chunk of textStream) {
                collectedContent += chunk
                const textPart = `0:${JSON.stringify(chunk)}\n\n`
                writer.write(encoder.encode(textPart))
            }

            // Process full stream
            await this.processFullStream(
                fullStream,
                writer,
                encoder,
                collectedContent,
                chatId,
                userId
            )

        } catch (error) {
            console.error('🔥 Stream process error:', error)
            throw error
        } finally {
            writer.close()
        }
    }

    private formatTools(tools: Tool[]) {
        return tools.reduce((acc, tool) => {
            acc[tool.toolName] = {
                description: tool.description,
                parameters: tool.parameters,
                execute: async (args: any) => {
                    if (tool.toolName === 'create_streamlit_app') {
                        return this.handleStreamlitCodeGeneration(args)
                    }
                    return tool.execute(args)
                }
            }
            return acc
        }, {} as Record<string, any>)
    }

    private async handleStreamlitCodeGeneration(args: any) {
        const query = `${args.query}\n${this.fileContext ? `Using file: ${this.fileContext.fileName}` : ''}`
        const { generatedCode } = await generateCode(query, this.fileContext)
        return generatedCode
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
                user: message.user_message,
                assistant: message.assistant_message,
                toolCalls: message.tool_calls.length,
                toolResults: message.tool_results.length
            }
        })

        const supabase = createRouteHandlerClient({ cookies })

        try {
            // Clean the assistant message by removing the metadata
            const cleanedAssistantMessage = message.assistant_message.replace(
                /d:{"finishReason":"[^"]+","usage":{[^}]+}}$/,
                ''
            )

            const userTokens = this.calculateTokenCount(message.user_message)
            const assistantTokens = this.calculateTokenCount(cleanedAssistantMessage)
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
                assistant_message: cleanedAssistantMessage,
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

    private processMessageHistory(messageHistory: any[]) {
        console.log('📝 Processing message history:', {
            messageCount: messageHistory.length
        })

        messageHistory.forEach(msg => {
            if (msg.user_message) {
                this.sanitizedMessages.push({
                    role: 'user',
                    content: msg.user_message
                })
                console.log('➕ Added user message:', {
                    timestamp: msg.created_at,
                    contentPreview: msg.user_message.substring(0, 50) + '...'
                })
            }
            if (msg.assistant_message) {
                this.sanitizedMessages.push({
                    role: 'assistant',
                    content: msg.assistant_message
                })
                console.log('➕ Added assistant message:', {
                    timestamp: msg.created_at,
                    contentPreview: msg.assistant_message.substring(0, 50) + '...'
                })
            }
        })

        console.log('✅ Message history processed:', {
            totalMessages: this.sanitizedMessages.length
        })
    }

    private async processFullStream(
        fullStream: any,
        writer: WritableStreamDefaultWriter,
        encoder: TextEncoder,
        collectedContent: string,
        chatId: string,
        userId: string
    ) {
        let toolCalls: any[] = [];
        let toolResults: any[] = [];

        for await (const step of fullStream) {
            if (step.type === 'tool-call') {
                if (step.toolName === 'create_streamlit_app') {
                    try {
                        // Emit streamlit status event
                        const statusData = `s:${JSON.stringify({
                            type: 'streamlit-status',
                            status: 'generating',
                            message: 'Generating Streamlit app...'
                        })}\n\n`
                        writer.write(encoder.encode(statusData))

                        const toolInput = step.args
                        const codeQuery = `${toolInput.query}\n${
                            this.fileContext ? `Using file: ${this.fileContext.fileName}` : ''
                        }`
                        const { generatedCode } = await generateCode(codeQuery, this.fileContext)

                        toolCalls.push({
                            id: step.toolCallId,
                            name: step.toolName,
                            args: step.args || {}
                        });

                        const toolCallStartData = `b:${JSON.stringify({
                            toolCallId: step.toolCallId,
                            toolName: step.toolName
                        })}\n\n`

                        const toolCallData = `9:${JSON.stringify({
                            toolCallId: step.toolCallId,
                            toolName: step.toolName,
                            args: step.args || {}
                        })}\n\n`

                        if (generatedCode) {
                            toolResults.push({
                                id: step.toolCallId,
                                name: step.toolName,
                                result: generatedCode
                            });

                            const toolResultData = `a:${JSON.stringify({
                                toolCallId: step.toolCallId,
                                result: generatedCode
                            })}\n\n`

                            writer.write(encoder.encode(toolCallStartData))
                            writer.write(encoder.encode(toolCallData))
                            writer.write(encoder.encode(toolResultData))
                        } else {
                            throw new Error('No code generated')
                        }

                        // Emit completion status
                        const completionData = `s:${JSON.stringify({
                            type: 'streamlit-status',
                            status: 'generated',
                            message: 'Starting Streamlit app...'
                        })}\n\n`
                        writer.write(encoder.encode(completionData))
                    } catch (error) {
                        const errorResult = `Error generating code: ${error instanceof Error ? error.message : 'Unknown error'}`;

                        toolResults.push({
                            id: step.toolCallId,
                            name: step.toolName,
                            result: errorResult
                        });

                        const toolResultData = `a:${JSON.stringify({
                            toolCallId: step.toolCallId,
                            result: errorResult
                        })}\n\n`
                        writer.write(encoder.encode(toolResultData))
                    }
                }
            } else if (step.type === 'text-delta') {
                if (step.content) {
                    const textData = `0:${JSON.stringify(step.content)}\n\n`
                    writer.write(encoder.encode(textData))
                }
            } else if (step.type === 'finish') {
                if (collectedContent) {
                    const latestUserMessage = this.sanitizedMessages
                        .filter(msg => msg.role === 'user')
                        .pop()

                    await this.storeMessage(chatId, userId, {
                        user_message: typeof latestUserMessage?.content === 'string'
                            ? latestUserMessage.content
                            : '',
                        assistant_message: collectedContent,
                        tool_calls: toolCalls,
                        tool_results: toolResults
                    })

                    const finishData = `d:${JSON.stringify({
                        finishReason: step.finishReason || 'stop',
                        usage: {
                            promptTokens: step.usage?.promptTokens || 0,
                            completionTokens: step.usage?.completionTokens || 0,
                            totalTokens: (step.usage?.promptTokens || 0) + (step.usage?.completionTokens || 0)
                        }
                    })}\n\n`
                    writer.write(encoder.encode(finishData))
                }
            }
        }
    }
}

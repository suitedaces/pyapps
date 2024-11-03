import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Message as VercelMessage } from 'ai'
import { cookies } from 'next/headers'
import { messageStore } from './messageStore'
import { generateCode } from './tools'
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
        messages: VercelMessage[],
        tools: Tool[],
        csvAnalysis?: any
    ) {
        console.log('🚀 Starting stream response in GruntyAgent', { chatId, userId })
        console.log('📨 Initial messages:', messages)
        console.log('🛠 Available tools:', tools.map(t => t.name))

        const encoder = new TextEncoder()
        const stream = new TransformStream({
            async transform(chunk, controller) {
                console.log('🔄 Transforming chunk:', chunk)
                controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
            },
        })

        const writer = stream.writable.getWriter()

        let collectedContent = ''

        const streamProcess = async () => {
            try {
                console.log('📡 Starting stream process')
                await this.model.streamText({
                    messages: [
                        {
                            role: 'system',
                            content: this.roleDescription,
                            id: 'system',
                            createdAt: new Date()
                        },
                        ...messages
                    ],
                    tools,
                    onToken: (token: string) => {
                        console.log('📝 Received token:', token)
                        collectedContent += token
                        writer.write({ type: 'text-delta', content: token })
                    },
                    onToolCall: async (toolInvocation: GruntyToolInvocation) => {
                        console.log('🔧 Tool call received:', toolInvocation)
                        if (toolInvocation.state === 'call' && toolInvocation.toolName === 'create_streamlit_app') {
                            console.log('🎨 Generating Streamlit code')
                            const { generatedCode } = await generateCode(
                                `${toolInvocation.args.query}\nCSV Analysis: ${JSON.stringify(csvAnalysis)}`
                            )

                            console.log('✨ Generated code:', generatedCode.substring(0, 100) + '...')
                            writer.write({
                                type: 'generated_code',
                                content: generatedCode
                            })

                            // Store tool interaction
                            await this.storeMessagePair(chatId, userId, {
                                user_message: '',
                                assistant_message: generatedCode,
                                tool_calls: [{
                                    id: toolInvocation.toolCallId,
                                    name: toolInvocation.toolName,
                                    parameters: toolInvocation.args
                                }],
                                tool_results: [{
                                    id: toolInvocation.toolCallId,
                                    name: toolInvocation.toolName,
                                    content: generatedCode
                                }]
                            })
                        }
                    }
                })

                // Store the complete message pair
                const finalMessage = messages[messages.length - 1]
                await this.storeMessagePair(chatId, userId, {
                    user_message: finalMessage.role === 'user' ? finalMessage.content : '',
                    assistant_message: collectedContent,
                    tool_calls: [],
                    tool_results: []
                })

            } catch (error) {
                console.error('❌ Error in stream process:', error)
                writer.write({ type: 'error', content: String(error) })
            } finally {
                console.log('👋 Closing stream writer')
                writer.close()
            }
        }

        streamProcess()
        console.log('🔄 Stream process initiated')
        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        })
    }

    private calculateTokenCount(text: string): number {
        return encode(text).length
    }

    private async storeMessagePair(
        chatId: string,
        userId: string,
        message: {
            user_message: string
            assistant_message: string
            tool_calls: any[]
            tool_results: any[]
        }
    ) {
        const supabase = createRouteHandlerClient({ cookies })

        try {
            // Calculate token counts
            const userTokens = this.calculateTokenCount(message.user_message)
            const assistantTokens = this.calculateTokenCount(message.assistant_message)
            const toolCallTokens = message.tool_calls?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_calls))
                : 0
            const toolResultTokens = message.tool_results?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_results))
                : 0

            // Total token count
            const totalTokens = userTokens + assistantTokens + toolCallTokens + toolResultTokens

            console.log('🔢 Token counts:', {
                userTokens,
                assistantTokens,
                toolCallTokens,
                toolResultTokens,
                totalTokens
            })

            const messageData = {
                chat_id: chatId,
                user_id: userId,
                user_message: message.user_message,
                assistant_message: message.assistant_message,
                tool_calls: message.tool_calls.length > 0 ? message.tool_calls : null,
                tool_results: message.tool_results.length > 0 ? message.tool_results : null,
                created_at: new Date().toISOString(),
                token_count: totalTokens // Updated token count
            }

            console.log('📝 Formatted message data:', messageData)

            const { data, error } = await supabase
                .from('messages')
                .insert(messageData)
                .select()

            if (error) {
                console.error('❌ Error storing message:', error)
                throw error
            }

            console.log('✅ Message stored successfully:', data)
            messageStore.setMessageStored(chatId)
            return data
        } catch (error) {
            console.error('Failed to store message:', error)
            throw error
        }
    }
}

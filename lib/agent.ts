import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Message as VercelMessage, StreamingTextResponse } from 'ai'
import { cookies } from 'next/headers'
import { messageStore } from './messageStore'
import { generateCode } from './tools'
import {
    ModelProvider,
    Tool,
    ToolCallPayload,
    LLMModelConfig,
    DatabaseMessage
} from './types'

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
        // Create a TransformStream for text streaming
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const stream = new TransformStream({
            async transform(chunk, controller) {
                controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
            },
        })

        const writer = stream.writable.getWriter()

        // Start the streaming process
        const streamProcess = async () => {
            try {
                await this.model.streamText({
                    messages: [
                        {
                            id: 'system',
                            role: 'system',
                            content: this.roleDescription,
                            createdAt: new Date()
                        },
                        ...messages
                    ],
                    tools,
                    onToken: (token: string) => {
                        writer.write({ type: 'text-delta', content: token })
                    },
                    onToolCall: async (tool: ToolCallPayload) => {
                        if (tool.name === 'create_streamlit_app') {
                            const { generatedCode } = await generateCode(
                                `${tool.arguments.query}\nCSV Analysis: ${JSON.stringify(csvAnalysis)}`
                            )

                            writer.write({
                                type: 'generated_code',
                                content: generatedCode
                            })
                        }
                    }
                })

                // Store the final message
                const finalMessage = messages[messages.length - 1]
                await this.storeMessage(chatId, userId, {
                    user_message: finalMessage.role === 'user' ? finalMessage.content : '',
                    assistant_message: finalMessage.role === 'assistant' ? finalMessage.content : '',
                    tool_calls: [],
                    tool_results: []
                })

            } catch (error) {
                console.error('Error in stream:', error)
                writer.write({ type: 'error', content: String(error) })
            } finally {
                writer.close()
            }
        }

        // Start streaming in the background
        streamProcess()

        // Return streaming response
        return new StreamingTextResponse(stream.readable)
    }

    private async storeMessage(
        chatId: string,
        userId: string,
        message: Partial<DatabaseMessage>
    ) {
        const supabase = createRouteHandlerClient({ cookies })

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    chat_id: chatId,
                    user_id: userId,
                    ...message,
                    created_at: new Date().toISOString(),
                })
                .select()

            if (error) throw error

            messageStore.setMessageStored(chatId)
            return data
        } catch (error) {
            console.error('Failed to store message:', error)
            throw error
        }
    }
}

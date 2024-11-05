import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { GruntyAgent } from '@/lib/agent'
import { getModelClient } from '@/lib/modelProviders'
import { tools } from '@/lib/tools'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { LLMModel, LLMModelConfig } from '@/lib/types'
import { Message, convertToCoreMessages } from 'ai'
import { generateUUID } from '@/lib/utils'

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { messages, model, config } = await req.json() as {
            messages: Message[]
            model: LLMModel
            config: LLMModelConfig
        }

        if (!messages?.length) {
            return new Response('No messages provided', { status: 400 })
        }

        // Generate a temporary chat ID for processing
        const tempChatId = generateUUID()

        const coreMessages = convertToCoreMessages(messages)
        const modelClient = getModelClient(model, {
            apiKey: process.env.ANTHROPIC_API_KEY,
            temperature: config?.temperature || 0.7,
            maxTokens: config?.maxTokens || 4096
        })

        const agent = new GruntyAgent(
            modelClient,
            'AI Assistant',
            CHAT_SYSTEM_PROMPT,
            {
                ...config,
                model: model.id
            }
        )

        // Get the stream response
        const stream = await agent.streamResponse(
            tempChatId,
            session.user.id,
            coreMessages,
            tools,
            null
        )

        // Create a transform stream to collect the entire response
        const { readable, writable } = new TransformStream()
        let assistantResponse = ''

        // Create a new TextDecoderStream to decode the chunks
        const decoder = new TextDecoderStream()
        const encoder = new TextEncoderStream()

        // Chain the streams together
        stream.body
            ?.pipeThrough(decoder)
            .pipeThrough(new TransformStream({
                transform(chunk, controller) {
                    assistantResponse += chunk
                    controller.enqueue(chunk)
                },
                flush: async (controller) => {
                    // Create the actual chat after we have the full response
                    const finalChatId = generateUUID()
                    const { error: chatError } = await supabase
                        .from('chats')
                        .insert([
                            {
                                id: finalChatId,
                                user_id: session.user.id,
                                name: messages[0].content.slice(0, 50) + '...',
                            }
                        ])

                    if (chatError) {
                        console.error('Failed to create chat:', chatError)
                        controller.error(chatError)
                        return
                    }

                    // Store the message pair
                    const { error: messageError } = await supabase
                        .from('messages')
                        .insert([
                            {
                                chat_id: finalChatId,
                                user_id: session.user.id,
                                user_message: messages[0].content,
                                assistant_message: assistantResponse,
                                token_count: 0, // You might want to calculate this
                            }
                        ])

                    if (messageError) {
                        console.error('Failed to store message:', messageError)
                        controller.error(messageError)
                        return
                    }

                    // Add a special marker to indicate the end of the stream
                    controller.enqueue(`\n__CHAT_ID__${finalChatId}__`)
                }
            }))
            .pipeThrough(encoder)
            .pipeTo(writable)

        // Add headers
        const headers = new Headers(stream.headers)
        headers.set('Content-Type', 'text/plain; charset=utf-8')

        return new Response(readable, {
            headers,
            status: 200,
        })

    } catch (error) {
        console.error('❌ Error in stream handler:', error)
        return new Response(
            JSON.stringify({
                error: 'Failed to process stream request',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
}

export const runtime = 'nodejs'

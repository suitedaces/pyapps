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

        // Generate a new chat ID
        const chatId = generateUUID()

        // Create the chat first
        const { error: chatError } = await supabase
            .from('chats')
            .insert([
                {
                    id: chatId,
                    user_id: session.user.id,
                    name: messages[0].content.slice(0, 50) + '...',
                }
            ])

        if (chatError) {
            throw new Error(`Failed to create chat: ${chatError.message}`)
        }

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
            chatId,
            session.user.id,
            coreMessages,
            tools,
            null
        )

        // Create a transform stream to add the chat ID at the end
        const { readable, writable } = new TransformStream()
        const textDecoder = new TextDecoderStream()
        const textEncoder = new TextEncoderStream()

        stream.body
            ?.pipeThrough(textDecoder)
            .pipeThrough(new TransformStream({
                transform(chunk, controller) {
                    controller.enqueue(chunk)
                },
                flush(controller) {
                    // Add the chat ID marker at the end
                    controller.enqueue(`\n__CHAT_ID__${chatId}__`)
                }
            }))
            .pipeThrough(textEncoder)
            .pipeTo(writable)

        return new Response(readable, {
            headers: stream.headers,
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

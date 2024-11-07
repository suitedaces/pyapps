import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { GruntyAgent } from '@/lib/agent'
import { getModelClient } from '@/lib/modelProviders'
import { tools } from '@/lib/tools'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { LLMModel, LLMModelConfig } from '@/lib/types'
import { Message, convertToCoreMessages } from 'ai'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    console.log('🎯 Stream route called for chat:', params.id)

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        console.log('❌ No session found')
        return new Response('Unauthorized', { status: 401 })
    }

    // Validate chat ID
    if (!params.id || params.id === 'null' || params.id === 'undefined') {
        console.log('❌ Invalid chat ID:', params.id)
        return new Response('Invalid chat ID', { status: 400 })
    }

    try {
        const { messages, model, config } = await req.json() as {
            messages: Message[]
            model: LLMModel
            config: LLMModelConfig
        }

        if (!messages?.length) {
            console.log('❌ No messages provided')
            return new Response('No messages provided', { status: 400 })
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

        return agent.streamResponse(
            params.id,
            session.user.id,
            coreMessages,
            tools,
            null
        )

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

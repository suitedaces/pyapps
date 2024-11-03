import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { GruntyAgent } from '@/lib/agent'
import { getModelClient } from '@/lib/modelProviders'
import { tools } from '@/lib/tools'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return new Response('Unauthorized', { status: 401 })
    }

    const { messages, model, config } = await req.json()

    if (!messages?.length) {
        return new Response('No messages provided', { status: 400 })
    }

    const modelClient = getModelClient(model, config)

    // Get CSV analysis if exists
    const { data: chatData } = await supabase
        .from('chats')
        .select('file_id')
        .eq('id', params.id)
        .single()

    let csvAnalysis = null
    if (chatData?.file_id) {
        const { data: fileData } = await supabase
            .from('files')
            .select('analysis')
            .eq('id', chatData.file_id)
            .single()

        csvAnalysis = fileData?.analysis
    }

    try {
        // Initialize the agent
        const agent = new GruntyAgent(
            modelClient,
            'AI Assistant',
            CHAT_SYSTEM_PROMPT,
            config
        )

        // Stream the response using the agent
        return await agent.streamResponse(
            params.id,
            session.user.id,
            messages,
            tools,
            csvAnalysis
        )

    } catch (error) {
        console.error('Error in stream processing:', error)
        return new Response(
            JSON.stringify({ error: 'Stream processing failed' }),
            { status: 500 }
        )
    }
}

export const runtime = 'nodejs'

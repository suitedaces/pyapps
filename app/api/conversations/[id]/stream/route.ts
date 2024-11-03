import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { GruntyAgent } from '@/lib/agent'
import { getModelClient } from '@/lib/modelProviders'
import { tools } from '@/lib/tools'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    console.log('🎯 Stream route called for chat:', params.id)

    if (!params.id || params.id === 'null') {
        console.error('❌ Invalid chat ID')
        return new Response('Invalid chat ID', { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        console.log('❌ No session found')
        return new Response('Unauthorized', { status: 401 })
    }

    const { messages, model, config } = await req.json()
    console.log('📨 Received request:', {
        messageCount: messages?.length,
        modelId: model?.id,
        configModel: config?.model
    })

    if (!messages?.length) {
        console.log('❌ No messages provided')
        return new Response('No messages provided', { status: 400 })
    }

    if (!model?.id) {
        console.log('❌ No model ID provided')
        return new Response('Model ID is required', { status: 400 })
    }

    try {
        const modelClient = getModelClient(model, config)
        console.log('🤖 Model client initialized:', modelClient.id)

        // Get CSV analysis if exists
        console.log('🔍 Checking for CSV analysis')
        const { data: chatData } = await supabase
            .from('chats')
            .select('file_id')
            .eq('id', params.id)
            .single()

        let csvAnalysis = null
        if (chatData?.file_id) {
            console.log('📊 Found file_id, fetching analysis')
            const { data: fileData } = await supabase
                .from('files')
                .select('analysis')
                .eq('id', chatData.file_id)
                .single()

            csvAnalysis = fileData?.analysis
            console.log('📈 CSV analysis loaded:', Boolean(csvAnalysis))
        }

        console.log('🚀 Initializing agent')
        const agent = new GruntyAgent(
            modelClient,
            'AI Assistant',
            CHAT_SYSTEM_PROMPT,
            config
        )

        console.log('📡 Starting stream response')
        return await agent.streamResponse(
            params.id,
            session.user.id,
            messages,
            tools,
            csvAnalysis
        )

    } catch (error) {
        console.error('❌ Error initializing model client:', error)
        return new Response(
            JSON.stringify({ error: 'Failed to initialize model client' }),
            { status: 500 }
        )
    }
}

export const runtime = 'nodejs'

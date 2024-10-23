import { GruntyAgent } from '@/lib/agent'
import { LLMModel, LLMModelConfig } from '@/lib/modelProviders'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { tools } from '@/lib/tools'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    console.log(req.json);


    const {
        message,
        // model,
        // config,
    }: {
        message: string
        // model: LLMModel
        // config: LLMModelConfig
    } = await req.json()

    // if (!model || !config) {
    //     console.error('Model or config missing in the request!')
    //     return NextResponse.json(
    //         { error: 'Model or config is missing.' },
    //         { status: 400 }
    //     )
    // }

    const model = {
        id: 'claude-3-5-sonnet-20240620',
        provider: 'Anthropic',
        providerId: 'anthropic',
        name: 'Claude 3.5 Sonnet',
        multiModal: true,
    }

    const config: LLMModelConfig = {
        model: 'claude-3-5-sonnet-20240620',
        apiKey: process.env.ANTHROPIC_API_KEY,
        temperature: 0.5,
        maxTokens: 1000,
    }

    console.log('Received message:', message)

    // Fetch CSV analysis if it exists for this chat
    const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', params.id)
        .single()

    if (chatError) {
        console.error('Error fetching chat data:', chatError)
        return NextResponse.json(
            { error: 'Failed to fetch chat data' },
            { status: 500 }
        )
    }

    let csvAnalysis = null
    if (chatData.file_id) {
        const { data: fileData, error: fileError } = await supabase
            .from('files')
            .select('analysis')
            .eq('id', chatData.file_id)
            .single()

        if (fileError) {
            console.error('Error fetching file analysis:', fileError)
        } else {
            csvAnalysis = fileData.analysis
        }
    }

    const encoder = new TextEncoder()

    try {
        const agent = new GruntyAgent(
            model,
            'AI Assistant',
            CHAT_SYSTEM_PROMPT,
            config
        )

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const chatGenerator = agent.chat(
                        params.id,
                        session.user.id,
                        message,
                        tools,
                        0.2,
                        4000,
                        csvAnalysis
                    )
                    console.log('Starting chat generator...')
                    for await (const chunk of chatGenerator) {
                        // console.log('Received chunk:', chunk) // Add this log
                        controller.enqueue(
                            encoder.encode(JSON.stringify(chunk) + '\n')
                        )
                    }
                    controller.close()
                } catch (err) {
                    console.error('Error in chat generator:', err)
                    controller.error(err)
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        })
    } catch (error) {
        console.error('Error in stream processing:', error)
        return NextResponse.json(
            { error: 'Stream processing failed' },
            { status: 500 }
        )
    }
}

export const runtime = 'nodejs'

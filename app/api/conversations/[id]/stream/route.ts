import { GruntyAgent } from '@/lib/agent'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { tools } from '@/lib/tools'
import { Anthropic } from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultHeaders: {
        'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    },
})

const agent = new GruntyAgent(
    anthropic,
    'claude-3-5-sonnet-20240620',
    'AI Assistant',
    CHAT_SYSTEM_PROMPT
)

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

    const { message } = await req.json()

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
        const stream = new ReadableStream({
            async start(controller) {
                const chatGenerator = agent.chat(
                    params.id,
                    session.user.id,
                    message,
                    tools,
                    0.7,
                    4000,
                    csvAnalysis
                )

                for await (const chunk of chatGenerator) {
                    controller.enqueue(
                        encoder.encode(JSON.stringify(chunk) + '\n')
                    )
                }

                controller.close()
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

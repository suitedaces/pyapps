import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { GruntyAgent } from '@/lib/agent'
import { tools } from '@/lib/tools'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  }
})

const agent = new GruntyAgent(
  anthropic,
  "claude-3-5-sonnet-20240620",
  "AI Assistant",
  CHAT_SYSTEM_PROMPT
)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { message } = await req.json()

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
          4000
        )

        for await (const chunk of chatGenerator) {
          controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
        }

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in stream processing:', error)
    return NextResponse.json({ error: 'Stream processing failed' }, { status: 500 })
  }
}

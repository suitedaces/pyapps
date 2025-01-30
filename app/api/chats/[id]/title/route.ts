import { createClient, getUser } from '@/lib/supabase/server'
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get chat messages directly from chats table
        const { data: chat, error } = await supabase
            .from('chats')
            .select('messages')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error) throw error
        if (!chat?.messages?.length) {
            return NextResponse.json(
                { title: 'New Chat' },
                { status: 200 }
            )
        }

        // Get the first user message
        const firstUserMessage = chat.messages.find(m => m.role === 'user')
        if (!firstUserMessage) {
            return NextResponse.json(
                { title: 'New Chat' },
                { status: 200 }
            )
        }

        // Generate title using AI with schema validation
        const { object } = await generateObject({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [
                {
                    role: 'system',
                    content: 'You are a project title generator. Generate very short, concise titles (max 50 chars). For file uploads, use format "Dataset: [brief description]". Keep titles clear but minimal.'
                },
                {
                    role: 'user',
                    content: firstUserMessage.content
                }
            ],
            schema: z.object({
                title: z
                    .string()
                    .max(50)
                    .describe('Generate a very short title (max 50 chars) that captures the essence of the conversation')
            }),
            temperature: 0.7
        })

        // Update chat title
        const { error: updateError } = await supabase
            .from('chats')
            .update({ name: object.title || 'New Chat' })
            .eq('id', id)
            .eq('user_id', user.id)

        if (updateError) throw updateError

        return NextResponse.json({ title: object.title || 'New Chat' })
    } catch (error) {
        console.error('Error generating title:', error)
        return NextResponse.json(
            { error: 'Failed to generate title' },
            { status: 500 }
        )
    }
}

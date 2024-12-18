import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const supabase = await createClient()
        const { id } = await context.params

        // Get the first message for this chat
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .select('user_message, assistant_message')
            .eq('chat_id', id)
            .order('created_at', { ascending: true })
            .limit(1)
            .single()

        if (messageError) throw messageError

        const { object } = await generateObject({
            model: anthropic('claude-3-haiku-20240307'),
            messages: [
                {
                    role: 'system',
                    content: 'Generate a concise, descriptive title (max 6 words) for this chat conversation based on the first exchange. Focus on the main topic or goal.'
                },
                {
                    role: 'user',
                    content: `User message: "${message.user_message}"\nAssistant response: "${message.assistant_message}"`
                }
            ],
            schema: z.object({
                title: z.string().max(100).describe('A concise title (max 8 words) that captures the main topic of the conversation, withoutq quotes or the word "conversation"')
            }),
            temperature: 0.7,
        })

        // Update chat title in database
        const { error: updateError } = await supabase
            .from('chats')
            .update({ name: object.title })
            .eq('id', id)

        if (updateError) throw updateError

        return NextResponse.json({ title: object.title })
    } catch (error) {
        console.error('Error generating title:', error)
        return NextResponse.json(
            { error: 'Failed to generate title' },
            { status: 500 }
        )
    }
}
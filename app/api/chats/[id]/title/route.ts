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
                    content: 'You are a project title generator for a conversational streamlit app builder web app.'
                },
                {
                    role: 'user',
                    content: `User message: "${message.user_message}"\nAssistant response: "${message.assistant_message}"`
                }
            ],
            schema: z.object({
                title: z.string().max(100).describe('Generate an 8-word title. Do not include quotes or the words "conversation", "streamlit", "app"')
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
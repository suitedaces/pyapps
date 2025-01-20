import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Fetch messages for a specific chat
export async function GET(req: NextRequest) {
    const user = await getUser()
    const searchParams = req.nextUrl.searchParams
    const chatId = searchParams.get('chatId')

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    if (!chatId) {
        return new Response('Chat ID is required', { status: 400 })
    }

    try {
        const supabase = await createClient()
        const { data: chat, error } = await supabase
            .from('chats')
            .select('messages')
            .eq('id', chatId)
            .eq('user_id', user.id)
            .single()

        if (error) throw error

        // Return the messages array directly from the chat object
        return NextResponse.json({ messages: chat?.messages || [] })
    } catch (error) {
        console.error('Failed to fetch messages:', error)
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        )
    }
}

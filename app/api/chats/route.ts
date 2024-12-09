import { createClient, getUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Fetch all conversations for the authenticated user
export async function GET() {
    const user = await getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const supabase = await createClient()
        const { data: chats, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ chats })
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch conversations' },
            { status: 500 }
        )
    }
}

// Create a new conversation
export async function POST(req: Request) {
    const user = await getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const supabase = await createClient()
        const body = await req.json()

        const { data: chat, error } = await supabase
            .from('chats')
            .insert({
                user_id: user.id,
                name: body.name || 'New Chat',
            })
            .select()
            .single()

        if (error) {
            console.log('ERROR:', error)
            throw error
        }

        return NextResponse.json(chat)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create conversation' },
            { status: 500 }
        )
    }
} 
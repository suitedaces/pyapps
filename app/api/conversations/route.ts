import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const page = Number(searchParams.get('page')) || 1
        const limit = Number(searchParams.get('limit')) || 15
        const offset = (page - 1) * limit
        const search = searchParams.get('search') || ''
        const chatId = searchParams.get('chatId')

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

        if (chatId) {
            console.log("Fetching messages for chatId:", chatId)

            const { data: messages, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true })

            console.log("DB Query result:", { messages, error: messagesError })

            if (messagesError) {
                console.error('Error fetching messages:', messagesError)
                return NextResponse.json(
                    { error: 'Failed to fetch messages' },
                    { status: 500 }
                )
            }

            return NextResponse.json({ messages })
        }

        // Get total count
        const countQuery = await supabase
            .from('chats')
            .select('*', { count: 'exact' })
            .eq('user_id', session.user.id)
            .ilike('name', search ? `%${search}%` : '%')

        const count = countQuery.count || 0

        // Get paginated results
        const { data: chats, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', session.user.id)
            .ilike('name', search ? `%${search}%` : '%')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Database error:', error)
            throw error
        }

        // Format the response
        const formattedChats =
            chats?.map((chat) => ({
                id: chat.id,
                name: chat.name || `Chat ${chat.id.slice(0, 8)}`,
                created_at: chat.created_at,
                last_message: chat.last_message,
                app_id: chat.app_id,
            })) || []

        return NextResponse.json({
            chats: formattedChats,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        })
    } catch (error) {
        console.error('Error in conversations route:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch conversations',
                details:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    console.log('📝 Creating new chat')

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        console.log('❌ No session found')
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { chatId } = await req.json() // Get the generated UUID from request body

        // Create a new chat with the provided UUID
        const { data: newChat, error } = await supabase
            .from('chats')
            .insert([{
                id: chatId, // Use the provided UUID
                user_id: session.user.id,
                name: 'New Chat',
                created_at: new Date().toISOString(),
            }])
            .select()
            .single()

        if (error) throw error

        console.log('✨ Created new chat:', newChat.id)
        return new Response(JSON.stringify({ chatId: newChat.id }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('❌ Error creating chat:', error)
        return new Response(
            JSON.stringify({
                error: 'Failed to create chat',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
}

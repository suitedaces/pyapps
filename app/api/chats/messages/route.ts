import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'gpt-tokenizer'

interface TokenCount {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

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
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

        if (error) throw error

        return NextResponse.json({ messages })
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        )
    }
}

export async function POST(req: Request) {
    const user = await getUser()
    const supabase = await createClient()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { 
            chatId,
            userMessage, 
            assistantMessage, 
            toolCalls, 
            toolResults,
            tokenCount
        } = await req.json()

        let currentChatId = chatId

        // Only create a new chat if we don't have one AND we have a message to store
        if (!currentChatId && userMessage && assistantMessage) {
            const { data: chat } = await supabase
                .from('chats')
                .insert({
                    user_id: user.id,
                    name: userMessage.slice(0, 50) + '...',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single()

            currentChatId = chat?.id
        }

        // Only store message if we have both user and assistant messages
        if (currentChatId && userMessage && assistantMessage) {
            const { data: message, error: messageError } = await supabase
                .from('messages')
                .insert({
                    chat_id: currentChatId,
                    user_id: user.id,
                    user_message: userMessage,
                    assistant_message: assistantMessage,
                    tool_calls: toolCalls,
                    tool_results: toolResults,
                    token_count: tokenCount,
                    created_at: new Date().toISOString(),
                })
            
            if (messageError) {
                console.error('Error storing message:', messageError)
                return new Response('Error storing message', { status: 500 })
            }
        }

        return Response.json({ 
            chatId: currentChatId 
        })
    } catch (error) {
        console.error('Error storing message chain:', error)
        return new Response('Error storing message', { status: 500 })
    }
}

// Update an existing message
export async function PUT(req: NextRequest) {
    const user = await getUser()
    const searchParams = req.nextUrl.searchParams
    const messageId = searchParams.get('messageId')

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    if (!messageId) {
        return new Response('Message ID is required', { status: 400 })
    }

    try {
        const supabase = await createClient()
        const body = await req.json()

        const { data, error } = await supabase
            .from('messages')
            .update({
                user_message: body.user_message,
                assistant_message: body.assistant_message,
                tool_calls: body.tool_calls,
                tool_results: body.tool_results,
                updated_at: new Date().toISOString(),
            })
            .eq('id', messageId)
            .select()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to update message' },
            { status: 500 }
        )
    }
}

// Delete a message
export async function DELETE(req: NextRequest) {
    const user = await getUser()
    const searchParams = req.nextUrl.searchParams
    const messageId = searchParams.get('messageId')

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    if (!messageId) {
        return new Response('Message ID is required', { status: 400 })
    }

    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to delete message' },
            { status: 500 }
        )
    }
} 
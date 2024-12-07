import { createClient } from '@/supabase/server'
import { encode } from 'gpt-tokenizer'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Fetch messages for a specific conversation
export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient()

    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', params.id)
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

// Store a new message in the conversation
export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient()
    const body = await req.json()

    try {
        // Calculate token counts for different message components
        const userTokens = encode(body.user_message || '').length
        const assistantTokens = encode(body.assistant_message || '').length
        const toolCallTokens = body.tool_calls
            ? encode(JSON.stringify(body.tool_calls)).length
            : 0
        const toolResultTokens = body.tool_results
            ? encode(JSON.stringify(body.tool_results)).length
            : 0

        const totalTokens =
            userTokens + assistantTokens + toolCallTokens + toolResultTokens

        // Prepare message data for storage
        const messageData = {
            chat_id: params.id,
            user_id: body.user_id,
            role: body.role,
            user_message: body.user_message,
            assistant_message: body.assistant_message,
            tool_calls: body.tool_calls || null,
            tool_results: body.tool_results || null,
            token_count: totalTokens,
            created_at: body.created_at || new Date().toISOString(),
        }

        const { data, error } = await supabase
            .from('messages')
            .insert(messageData)
            .select()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to store message' },
            { status: 500 }
        )
    }
}

// Update an existing message
export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient()
    const body = await req.json()

    try {
        const { data, error } = await supabase
            .from('messages')
            .update({
                user_message: body.user_message,
                assistant_message: body.assistant_message,
                tool_calls: body.tool_calls,
                tool_results: body.tool_results,
                updated_at: new Date().toISOString(),
            })
            .eq('id', params.id)
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
export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient()

    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', params.id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to delete message' },
            { status: 500 }
        )
    }
}

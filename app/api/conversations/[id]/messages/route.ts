import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { encode } from 'gpt-tokenizer'

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    console.log('📥 GET /api/conversations/[id]/messages', {
        chatId: params.id
    })

    const supabase = createRouteHandlerClient({ cookies })

    try {
        console.log('🔍 Querying Supabase for messages')
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', params.id)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('❌ Supabase error:', error)
            throw error
        }

        console.log('✅ Messages retrieved:', {
            count: messages.length,
            firstMessage: messages[0],
            lastMessage: messages[messages.length - 1]
        })

        return NextResponse.json({ messages })
    } catch (error) {
        console.error('🚨 Error in GET /messages:', error)
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        )
    }
}

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await req.json()

    try {
        // Calculate token count
        const userTokens = encode(body.user_message || '').length
        const assistantTokens = encode(body.assistant_message || '').length
        const toolCallTokens = body.tool_calls ? encode(JSON.stringify(body.tool_calls)).length : 0
        const toolResultTokens = body.tool_results ? encode(JSON.stringify(body.tool_results)).length : 0

        const totalTokens = userTokens + assistantTokens + toolCallTokens + toolResultTokens

        console.log('🔢 Token counts:', {
            userTokens,
            assistantTokens,
            toolCallTokens,
            toolResultTokens,
            totalTokens
        })

        const messageData = {
            chat_id: params.id,
            user_id: body.user_id,
            role: body.role,
            user_message: body.user_message,
            assistant_message: body.assistant_message,
            tool_calls: body.tool_calls || null,
            tool_results: body.tool_results || null,
            token_count: totalTokens,
            created_at: body.created_at || new Date().toISOString()
        }

        console.log('📝 Storing message:', messageData)

        const { data, error } = await supabase
            .from('messages')
            .insert(messageData)
            .select()

        if (error) {
            console.error('Error storing message:', error)
            throw error
        }

        console.log('✅ Message stored successfully:', data)
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error in POST /messages:', error)
        return NextResponse.json(
            { error: 'Failed to store message' },
            { status: 500 }
        )
    }
}

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await req.json()

    try {
        const { data, error } = await supabase
            .from('messages')
            .update({
                user_message: body.user_message,
                assistant_message: body.assistant_message,
                tool_calls: body.tool_calls,
                tool_results: body.tool_results,
                updated_at: new Date().toISOString()
            })
            .eq('id', params.id)
            .select()

        if (error) {
            console.error('Error updating message:', error)
            throw error
        }

        console.log('✅ Message updated successfully:', data)
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error in PUT /messages:', error)
        return NextResponse.json(
            { error: 'Failed to update message' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies })

    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', params.id)

        if (error) {
            console.error('Error deleting message:', error)
            throw error
        }

        console.log('✅ Message deleted successfully')
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error in DELETE /messages:', error)
        return NextResponse.json(
            { error: 'Failed to delete message' },
            { status: 500 }
        )
    }
}

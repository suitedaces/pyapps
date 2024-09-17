import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
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

    const { data, error } = await supabase.rpc('get_chat_messages', {
        p_chat_id: params.id,
        p_limit: 50,
        p_offset: 0,
    })

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
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

    const {
        user_message,
        assistant_message,
        token_count,
        tool_calls,
        tool_results,
    } = await req.json()

    const { data, error } = await supabase
    .from('messages')
    .insert({
        chat_id: params.id,
        user_id: session.user.id,
        user_message: user_message,
        assistant_message: assistant_message,
        tool_calls: tool_calls,
        tool_results: tool_results,
        token_count: token_count
    })
    .select()
    if (error) {
        return NextResponse.json(
            { error: 'Failed to create message' },
            { status: 500 }
        )
    }

    return NextResponse.json({ id: data })
}
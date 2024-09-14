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

    const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', session.user.id)
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch conversation' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

export async function PATCH(
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

    const { name } = await req.json()

    const { data, error } = await supabase
        .from('chats')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('user_id', session.user.id)
        .select()
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to update conversation' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

export async function DELETE(
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

    const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', params.id)
        .eq('user_id', session.user.id)

    if (error) {
        return NextResponse.json(
            { error: 'Failed to delete conversation' },
            { status: 500 }
        )
    }

    return NextResponse.json({ success: true })
}

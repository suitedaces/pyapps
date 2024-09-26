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
        p_limit: 2,
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

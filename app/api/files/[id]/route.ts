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
        .from('files')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', session.user.id)
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch file' },
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
        .from('files')
        .delete()
        .eq('id', params.id)
        .eq('user_id', session.user.id)

    if (error) {
        return NextResponse.json(
            { error: 'Failed to delete file' },
            { status: 500 }
        )
    }

    return NextResponse.json({ success: true })
}

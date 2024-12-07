import { createClient } from '@/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient()
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
        .from('apps')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', session.user.id)
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch app' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient()
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    const { name, description } = await req.json()

    const { data, error } = await supabase
        .from('apps')
        .update({ name, description, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('user_id', session.user.id)
        .select()
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to update app' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient()
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
        .from('apps')
        .delete()
        .eq('id', params.id)
        .eq('user_id', session.user.id)

    if (error) {
        return NextResponse.json(
            { error: 'Failed to delete app' },
            { status: 500 }
        )
    }

    return NextResponse.json({ success: true })
}

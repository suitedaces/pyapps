import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
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
        .from('apps')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch apps' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
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

    const { name, description } = await req.json()

    const { data, error } = await supabase
        .from('apps')
        .insert({
            user_id: session.user.id,
            name,
            description,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to create app' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

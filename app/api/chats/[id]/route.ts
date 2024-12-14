import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: chat, error } = await supabase
        .from('chats')
        .select(
            `
            *,
            app:app_id (
                id
            )
        `
        )
        .eq('id', id)
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch chat' },
            { status: 500 }
        )
    }

    return NextResponse.json({ chat })
}

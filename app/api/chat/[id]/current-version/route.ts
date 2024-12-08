import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
    const { id } = await context.params
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { data, error } = await supabase.rpc(
            'get_chat_current_app_version',
            { p_chat_id: id }
        )

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error fetching chat version:', error)
        return NextResponse.json(
            { error: 'Failed to fetch chat version' },
            { status: 500 }
        )
    }
}

export const runtime = 'nodejs' 
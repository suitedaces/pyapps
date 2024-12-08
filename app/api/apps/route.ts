import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const supabase = createClient()
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
    const supabase = createClient()
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { chatId, code, appName, appDescription } = await req.json()

        if (!chatId || !code || !appName) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase.rpc(
            'handle_streamlit_tool_response',
            {
                p_user_id: session.user.id,
                p_chat_id: chatId,
                p_code: code,
                p_app_name: appName,
                p_app_description: appDescription || null
            }
        )

        if (error) {
            console.error('RPC Error:', error)
            return NextResponse.json(
                { error: 'Failed to create app version' },
                { status: 500 }
            )
        }

        return NextResponse.json(data)

    } catch (error) {
        console.error('Error in POST /api/apps:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

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
        .from('usage_limits')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch usage data' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

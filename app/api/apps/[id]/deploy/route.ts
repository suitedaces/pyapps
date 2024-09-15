import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// TODO: Complete the implementation of this route
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

    const { versionId } = await req.json()

    const { data, error } = await supabase.rpc('update_app_public_status', {
        p_app_id: params.id,
        p_version_id: versionId,
        v_public_id: `app_${params.id}_${Date.now()}`,
    })

    if (error) {
        return NextResponse.json(
            { error: 'Failed to deploy app' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

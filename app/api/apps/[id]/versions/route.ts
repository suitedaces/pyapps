import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Get all versions for an app
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

    try {
        // Use the RPC function to get versions
        const { data, error } = await supabase.rpc('get_app_versions', {
            p_app_id: params.id,
        })

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch versions' },
            { status: 500 }
        )
    }
}

// Create a new version
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

    try {
        const { code } = await req.json()

        const { data, error } = await supabase.rpc('create_app_version', {
            p_app_id: params.id,
            p_code: code,
        })

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create version' },
            { status: 500 }
        )
    }
}

// Switch to a specific version
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

    try {
        const { versionId } = await req.json()

        // Use the RPC function to switch version
        const { data, error } = await supabase.rpc('switch_app_version', {
            p_app_id: params.id,
            p_version_id: versionId,
        })

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to switch version' },
            { status: 500 }
        )
    }
}

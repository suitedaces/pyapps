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
        .from('app_versions')
        .select('*')
        .eq('app_id', params.id)
        .order('version_number', { ascending: false })

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch app versions' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

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

    const { code } = await req.json()

    // Get the latest version number
    const { data: latestVersion, error: versionError } = await supabase
        .from('app_versions')
        .select('version_number')
        .eq('app_id', params.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

    if (versionError && versionError.code !== 'PGRST116') {
        return NextResponse.json(
            { error: 'Failed to get latest version' },
            { status: 500 }
        )
    }

    const newVersionNumber = latestVersion
        ? latestVersion.version_number + 1
        : 1

    const { data, error } = await supabase
        .from('app_versions')
        .insert({
            app_id: params.id,
            version_number: newVersionNumber,
            code,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to create app version' },
            { status: 500 }
        )
    }

    return NextResponse.json(data)
}

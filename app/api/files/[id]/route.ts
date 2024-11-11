import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        // Fetch file with content and analysis
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', params.id)
            .eq('user_id', session.user.id)
            .single()

        if (error || !data) {
            return NextResponse.json(
                { error: 'File not found or access denied' },
                { status: 404 }
            )
        }

        // Check if file has expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
            await supabase
                .from('files')
                .delete()
                .eq('id', params.id)

            return NextResponse.json(
                { error: 'File has expired' },
                { status: 410 }
            )
        }

        return NextResponse.json(data)

    } catch (error) {
        console.error('Failed to fetch file:', error)
        return NextResponse.json(
            { error: 'Failed to fetch file' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        // Delete file record
        const { error } = await supabase
            .from('files')
            .delete()
            .eq('id', params.id)
            .eq('user_id', session.user.id)

        if (error) throw error

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Failed to delete file:', error)
        return NextResponse.json(
            { error: 'Failed to delete file' },
            { status: 500 }
        )
    }
}

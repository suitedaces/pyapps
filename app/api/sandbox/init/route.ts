import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const sandbox = await Sandbox.create({
            apiKey: process.env.E2B_API_KEY,
            template: 'streamlit-sandbox-me',
        })

        await sandbox.filesystem.makeDir('/app')

        const { data: files } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (files && files.content_hash) {
            await sandbox.filesystem.write(
                `/app/${files.file_name}`,
                files.content_hash
            )
        }

        await sandbox.keepAlive(10 * 60 * 1000)

        return NextResponse.json({ sandboxId: sandbox.id })
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to initialize sandbox' },
            { status: 500 }
        )
    }
}

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
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
        // First verify app ownership
        const { data: app, error: appError } = await supabase
            .from('apps')
            .select('current_version_id')
            .eq('id', params.id)
            .eq('user_id', session.user.id)
            .single()

        if (appError || !app) {
            return NextResponse.json(
                { error: 'App not found or access denied' },
                { status: 404 }
            )
        }

        // Get current version's code
        if (!app.current_version_id) {
            return NextResponse.json(
                { error: 'No version available' },
                { status: 400 }
            )
        }

        const { data: version, error: versionError } = await supabase
            .from('app_versions')
            .select('code')
            .eq('id', app.current_version_id)
            .single()

        if (versionError || !version) {
            return NextResponse.json(
                { error: 'Version not found' },
                { status: 404 }
            )
        }

        // Execute in sandbox
        const sandbox = await Sandbox.reconnect(params.id)
        await sandbox.filesystem.write('/app/app.py', version.code)

        const process = await sandbox.process.start({
            cmd: 'streamlit run /app/app.py',
            onStdout: (data) => console.log('Streamlit stdout:', data),
            onStderr: (data) => console.error('Streamlit stderr:', data),
        })

        const url = sandbox.getHostname(8501)
        return NextResponse.json({ url: `https://${url}` })

    } catch (error) {
        console.error('Sandbox execution error:', error)
        return NextResponse.json(
            { error: 'Failed to execute code in sandbox' },
            { status: 500 }
        )
    }
}

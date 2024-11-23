import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    // Get user session - need this for auth
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    // Kick them out if not logged in
    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        // Get the code from request body - we need this to run in sandbox
        const { code } = await req.json()
        if (!code) {
            return NextResponse.json(
                { error: 'No code provided' },
                { status: 400 }
            )
        }

        // Reconnect to existing sandbox using ID from URL
        const sandbox = await Sandbox.reconnect(params.id)

        // Write the Python code to a file in sandbox
        await sandbox.filesystem.write('/app/app.py', code)

        // Fire up streamlit with the code
        // Added logs so we can debug if something breaks
        const process = await sandbox.process.start({
            cmd: 'streamlit run /app/app.py',
            onStdout: (data) => console.log('Streamlit stdout:', data),
            onStderr: (data) => console.error('Streamlit stderr:', data),
        })

        // Get the URL where the app is running and send it back
        const url = sandbox.getHostname(8501)
        return NextResponse.json({ url: `https://${url}` })

    } catch (error) {
        // Something went wrong - log it and let the user know
        console.error('Sandbox execution error:', error)
        return NextResponse.json(
            { error: 'Failed to execute code in sandbox' },
            { status: 500 }
        )
    }
}

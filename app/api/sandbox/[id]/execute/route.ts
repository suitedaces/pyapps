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

    const { code } = await req.json()
    const sandbox = await Sandbox.reconnect(params.id)

    try {
        await sandbox.filesystem.write('/app/app.py', code)
        const process = await sandbox.process.start({
            cmd: 'streamlit run /app/app.py',
            onStdout: (data) => console.log('Streamlit stdout:', data),
            onStderr: (data) => console.error('Streamlit stderr:', data),
        })

        const url = sandbox.getHostname(8501)
        return NextResponse.json({ url: `https://${url}` })
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to execute code in sandbox' },
            { status: 500 }
        )
    }
}

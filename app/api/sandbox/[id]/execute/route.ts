import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'


export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
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
    const sandbox = await Sandbox.reconnect(params.id)

    try {
        await sandbox.filesystem.write('/app/app.py', code)
        const process = await sandbox.process.start({
            cmd: 'streamlit run /app/app.py',
            onStdout: (data) => console.log('Streamlit stdout:', data),
            onStderr: (data) => console.error('Streamlit stderr:', data),
        })

        const url = sandbox.getHostname(8501)

        // POST /api/apps/{id}/versions with code and app_id

        // const response = await fetch(`${NEXT_PUBLIC_BASE_URL}/api/apps/${params.id}/versions`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify({ code, app_id: params.id }),
        // })

        // if (!response.ok) {
        //     throw new Error('Failed to save app version')
        // }

        return NextResponse.json({ url: `https://${url}` })
    } catch (error) {
        console.error('Error executing code in sandbox:', error)
        return NextResponse.json(
            { error: 'Failed to execute code in sandbox' },
            { status: 500 }
        )
    }
}

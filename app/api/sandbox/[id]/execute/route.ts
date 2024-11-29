import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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
        const body = await req.json()
        console.log('Received request body:', body)

        const codeContent = typeof body.code === 'object' && body.code.code
            ? body.code.code
            : body.code

        if (!codeContent || typeof codeContent !== 'string') {
            console.error('Invalid code format:', body.code)
            return NextResponse.json(
                { error: 'Invalid code format. Expected string.' },
                { status: 400 }
            )
        }

        console.log('Connecting to sandbox:', params.id)
        const sandbox = await Sandbox.reconnect(params.id)

        console.log('Writing code to sandbox:', codeContent.substring(0, 100) + '...')
        await sandbox.filesystem.write('/app/app.py', codeContent)

        console.log('Starting Streamlit process')
        const process = await sandbox.process.start({
            cmd: 'streamlit run /app/app.py',
            onStdout: (data) => console.log('Streamlit stdout:', data),
            onStderr: (data) => console.error('Streamlit stderr:', data),
        })

        const url = sandbox.getHostname(8501)
        console.log('Sandbox URL:', url)

        return NextResponse.json({ url: `https://${url}` })
    } catch (error) {
        // Type guard for Error objects
        const errorMessage = error instanceof Error
            ? error.message
            : 'An unknown error occurred'

        const errorStack = error instanceof Error
            ? error.stack
            : undefined

        console.error('Detailed sandbox execution error:', {
            error,
            message: errorMessage,
            stack: errorStack,
        })

        return NextResponse.json(
            {
                error: 'Failed to execute code in sandbox',
                details: errorMessage
            },
            { status: 500 }
        )
    }
}

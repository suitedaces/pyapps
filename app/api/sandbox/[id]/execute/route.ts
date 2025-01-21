import { createClient, getUser } from '@/lib/supabase/server'
import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest, NextResponse } from 'next/server'
import { setupS3Mount } from '@/lib/s3'

interface RouteContext {
    params: Promise<{ id: string }>
}   

export const maxDuration = 30

async function listUserSandboxes(userId: string): Promise<Sandbox[]> {
    try {
        const sandboxes = await Sandbox.list()
        const userSandboxes = sandboxes.filter(
            (s) =>
                s.metadata &&
                typeof s.metadata === 'object' &&
                'userId' in s.metadata &&
                s.metadata.userId === userId
        )

        const fullSandboxes = await Promise.all(
            userSandboxes.map((s) => Sandbox.connect(s.sandboxId))
        )
        return fullSandboxes
    } catch (error) {
        console.error('Error listing sandboxes:', error)
        return []
    }
}

async function cleanupOldSandboxes(
    sandboxes: Sandbox[],
    keepSandboxId?: string
) {
    for (const sandbox of sandboxes) {
        if (keepSandboxId && sandbox.sandboxId === keepSandboxId) continue
        try {
            await sandbox.kill()
            console.log(`Destroyed sandbox ${sandbox.sandboxId}`)
        } catch (error) {
            console.error(`Failed to destroy sandbox ${sandbox.sandboxId}:`, error)
        }
    }
}

async function killStreamlitProcess(sandbox: Sandbox) {
    try {
        // Force kill any running processes and ignore errors
        await sandbox.commands.run('pkill -9 -f "streamlit run" || true', { timeoutMs: 5000 })
        await sandbox.commands.run('rm -f /app/app.py || true', { timeoutMs: 5000 })
        
        // Ensure cleanup is complete
        await new Promise((resolve) => setTimeout(resolve, 1000))
        
        console.log('✅ Cleaned up existing Streamlit process and app file')
    } catch (error) {
        // Log but continue execution
        console.warn('⚠️ Sandbox cleanup error:', error)
    }
}

// Add new function to list session sandboxes
async function listSessionSandboxes(sessionId: string): Promise<Sandbox[]> {
    try {
        const sandboxes = await Sandbox.list()
        const sessionSandboxes = sandboxes.filter(
            (s) =>
                s.metadata &&
                typeof s.metadata === 'object' &&
                'sessionId' in s.metadata &&
                s.metadata.sessionId === sessionId
        )

        const fullSandboxes = await Promise.all(
            sessionSandboxes.map((s) => Sandbox.connect(s.sandboxId))
        )
        return fullSandboxes
    } catch (error) {
        console.error('Error listing session sandboxes:', error)
        return []
    }
}

export async function POST(req: NextRequest, context: RouteContext) {
    const user = await getUser()
    const { id } = await context.params
    const sessionId = req.headers.get('x-session-id')
    const appId = req.headers.get('x-app-id')

    // Get app owner's user ID
    let ownerUserId: string | null = null
    if (appId) {
        const supabase = await createClient()
        const { data: app } = await supabase
            .from('apps')
            .select('user_id')
            .eq('id', appId)
            .single()

        ownerUserId = app?.user_id || null
    }

    if (!ownerUserId && user) {
        ownerUserId = user.id
    }

    if (!ownerUserId) {
        return NextResponse.json(
            { error: 'Could not determine app owner' },
            { status: 400 }
        )
    }

    try {
        const body = await req.json()
        const codeContent =
            typeof body.code === 'object' && body.code.code
                ? body.code.code
                : body.code

        if (!codeContent || typeof codeContent !== 'string') {
            console.error('Invalid code format:', body.code)
            return NextResponse.json(
                { error: 'Invalid code format. Expected string.' },
                { status: 400 }
            )
        }

        let sandbox: Sandbox

        if (user) {
            // Authenticated user flow - keep existing functionality
            const existingSandboxes = await listUserSandboxes(user.id)

            if (id !== 'new' && existingSandboxes.some((s) => s.sandboxId === id)) {
                sandbox = await Sandbox.connect(id)
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, id)
            } else if (existingSandboxes.length > 0) {
                sandbox = existingSandboxes[0]
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, sandbox.sandboxId)
            } else {
                sandbox = await Sandbox.create('streamlit-sandbox-s3', {
                    apiKey: process.env.E2B_API_KEY!,
                    metadata: {
                        userId: user.id,
                    },
                })
            }

            // Keep sandbox alive
            await sandbox.setTimeout(2 * 60 * 1000) // 2 minutes
        } else {
            // Require session ID for unauthenticated users
            if (!sessionId) {
                return NextResponse.json(
                    { error: 'Session ID required for unauthenticated users' },
                    { status: 400 }
                )
            }

            // Handle unauthenticated user flow
            const existingSandboxes = await listSessionSandboxes(sessionId)

            if (id !== 'new' && existingSandboxes.some((s) => s.sandboxId === id)) {
                sandbox = await Sandbox.connect(id)
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, id)
            } else if (existingSandboxes.length > 0) {
                sandbox = existingSandboxes[0]
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, sandbox.sandboxId)
            } else {
                sandbox = await Sandbox.create('streamlit-sandbox-s3', {
                    apiKey: process.env.E2B_API_KEY!,
                    metadata: {
                        sessionId,
                        isPublic: 'true',
                        createdAt: new Date().toISOString(),
                    },
                })
                // Keep sandbox alive
                await sandbox.setTimeout(0.5 * 60 * 1000) // 30 seconds
            }
        }

        await setupS3Mount(sandbox, ownerUserId)
        // Write and execute code (common for both flows)
        // console.log('Writing code to sandbox: ', codeContent)
        await sandbox.files.write('/app/app.py', codeContent)

        console.log('Starting Streamlit process')
        await sandbox.commands.run('streamlit run /app/app.py --server.address=0.0.0.0 --server.port=8501', {
            background: true,
            onStdout: (data) => console.log('Streamlit:', data),
            onStderr: (data) => console.error('Streamlit error:', data),
        })

        // Quick check for URL availability
        const url = await sandbox.getHost(8501)
        console.log('Sandbox URL:', url)

        return NextResponse.json({
            url: `https://${url}`,
            sandboxId: sandbox.sandboxId,
        })
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'An unknown error occurred'

        console.error('Sandbox execution error:', {
            error,
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
        })

        return NextResponse.json(
            {
                error: 'Failed to execute code in sandbox',
                details: errorMessage,
            },
            { status: 500 }
        )
    }
}

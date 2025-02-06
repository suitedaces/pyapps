import { createClient, getUser } from '@/lib/supabase/server'
import { Sandbox } from 'e2b'
import { NextRequest, NextResponse } from 'next/server'
import { setupS3Mount } from '@/lib/s3'


export const maxDuration = 60

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

        console.log(`Found ${userSandboxes.length} sandboxes for user ${userId}`)
        
        const fullSandboxes = await Promise.all(
            userSandboxes.map((s) => Sandbox.reconnect(s.sandboxID))
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
    console.log(`Cleaning up ${sandboxes.length} sandboxes`)
    for (const sandbox of sandboxes) {
        if (keepSandboxId && sandbox.id === keepSandboxId) continue
        try {
            await sandbox.close()
            console.log(`✅ Destroyed sandbox ${sandbox.id}`)
        } catch (error) {
            console.error(`Failed to destroy sandbox ${sandbox.id}:`, error)
        }
    }
}

async function killStreamlitProcess(sandbox: Sandbox) {
    try {
        // Kill any running streamlit processes
        await sandbox.process.startAndWait('pkill -f "streamlit run" || true')
        // Remove existing app file
        await sandbox.process.startAndWait('rm -f /app/app.py')
        console.log('✅ Cleaned up existing Streamlit process and app file')
    } catch (error) {
        console.error('❌ Error during cleanup:', error)
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
            sessionSandboxes.map((s) => Sandbox.reconnect(s.sandboxID))
        )
        return fullSandboxes
    } catch (error) {
        console.error('Error listing session sandboxes:', error)
        return []
    }
}

async function waitForStreamlit(url: string, maxRetries = 10): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url)
            const text = await response.text()
            
            // Check if response contains 502 error
            if (!text.includes('502') && response.ok) {
                console.log('✅ Streamlit is running properly')
                return true
            }
            
            console.log(`⏳ Attempt ${i + 1}/${maxRetries}: Streamlit not ready because: ${text}`)
            await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
            console.log(`⚠️ Attempt ${i + 1}/${maxRetries}: Error checking Streamlit:`, error)
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }
    return false
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getUser()
    const { id } = await params
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

            if (id !== 'new' && existingSandboxes.some((s) => s.id === id)) {
                sandbox = await Sandbox.reconnect(id)
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, id)
            } else if (existingSandboxes.length > 0) {
                sandbox = existingSandboxes[0]
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, sandbox.id)
            } else {
                sandbox = await Sandbox.create({
                    template: 'streamlit-sandbox-s3',
                    apiKey: process.env.E2B_API_KEY!,
                    metadata: {
                        userId: user.id,
                    },
                })
            }

            // Keep sandbox alive
            await sandbox.keepAlive(3 * 60 * 1000) // 3 minutes
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

            if (id !== 'new' && existingSandboxes.some((s) => s.id === id)) {
                sandbox = await Sandbox.reconnect(id)
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, id)
            } else if (existingSandboxes.length > 0) {
                sandbox = existingSandboxes[0]
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, sandbox.id)
            } else {
                sandbox = await Sandbox.create({
                    template: 'streamlit-sandbox-s3',
                    apiKey: process.env.E2B_API_KEY!,
                    metadata: {
                        sessionId,
                        isPublic: 'true',
                        createdAt: new Date().toISOString(),
                    },
                })
                // Keep sandbox alive
                await sandbox.keepAlive(1.5 * 60 * 1000) // 1.5 minutes
            }
        }

        await setupS3Mount(sandbox, ownerUserId)
        
        console.log('📝 Writing code to sandbox')
        await sandbox.filesystem.write('/app/app.py', codeContent)

        console.log('🚀 Starting Streamlit process')
        await sandbox.process.start({
            cmd: 'streamlit run /app/app.py',
            onStdout: (data: string) => console.log('Streamlit stdout:', data),
            onStderr: (data: string) => console.error('Streamlit stderr:', data),
        } as any)

        const url = sandbox.getHostname(8501)

        const fullUrl = `https://${url}`
        console.log('🌐 New sandbox URL:', fullUrl)

        // Wait for Streamlit to be ready
        const isReady = await waitForStreamlit(fullUrl)
        if (!isReady) {
            console.log('❌ Streamlit failed to start properly after retries')
            await sandbox.close()
            return NextResponse.json(
                { error: 'Streamlit failed to start properly' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            url: fullUrl,
            sandboxId: sandbox.id,
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

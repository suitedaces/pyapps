import { createClient } from '@/lib/supabase/server'
import { Sandbox, Process, ProcessMessage } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'

interface RouteContext {
    params: Promise<{ id: string }>
}

async function listUserSandboxes(userId: string): Promise<Sandbox[]> {
    try {
        const sandboxes = await Sandbox.list()
        const userSandboxes = sandboxes.filter(s => 
            s.metadata && 
            typeof s.metadata === 'object' && 
            'userId' in s.metadata && 
            s.metadata.userId === userId
        )
        
        const fullSandboxes = await Promise.all(
            userSandboxes.map(s => Sandbox.reconnect(s.sandboxID))
        )
        return fullSandboxes
    } catch (error) {
        console.error('Error listing sandboxes:', error)
        return []
    }
}

async function cleanupOldSandboxes(sandboxes: Sandbox[], keepSandboxId?: string) {
    for (const sandbox of sandboxes) {
        if (keepSandboxId && sandbox.id === keepSandboxId) continue
        try {
            await sandbox.close()
            console.log(`Destroyed sandbox ${sandbox.id}`)
        } catch (error) {
            console.error(`Failed to destroy sandbox ${sandbox.id}:`, error)
        }
    }
}

async function killStreamlitProcess(sandbox: Sandbox) {
    try {
        // Kill any running streamlit processes
        await sandbox.process.start({
            cmd: 'pkill -f "streamlit run" || true'
        })
        
        // Remove existing app file
        await sandbox.process.start({
            cmd: 'rm -f /app/app.py'
        })

        // Small delay to ensure process is fully terminated
        await new Promise(resolve => setTimeout(resolve, 500))
        
        console.log('✅ Cleaned up existing Streamlit process and app file')
    } catch (error) {
        console.error('❌ Error during cleanup:', error)
    }
}

export async function POST(
    req: NextRequest,
    context: RouteContext,
) {
    const supabase = await createClient()
    const user = await getUser()

    const { id } = await context.params
    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 } 
        )
    }

    try {
        const body = await req.json()
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

        // List existing sandboxes for the user
        const existingSandboxes = await listUserSandboxes(user.id)
        let sandbox: Sandbox

        if (id !== 'new' && existingSandboxes.some(s => s.id === id)) {
            // Reconnect to specific sandbox if ID provided and exists
            sandbox = await Sandbox.reconnect(id)
            await killStreamlitProcess(sandbox)  // Kill process and clean up
            await cleanupOldSandboxes(existingSandboxes, id)
        } else if (existingSandboxes.length > 0) {
            // Reuse the first existing sandbox
            sandbox = existingSandboxes[0]
            await killStreamlitProcess(sandbox)  // Kill process and clean up
            await cleanupOldSandboxes(existingSandboxes, sandbox.id)
        } else {
            // Create new sandbox if none exist
            sandbox = await Sandbox.create({
                apiKey: process.env.E2B_API_KEY!,
                template: 'streamlit-sandbox-s3',
                metadata: {
                    userId: user.id
                }
            })
        }

        // Setup S3 mount if new sandbox
        if (id === 'new' || existingSandboxes.length === 0) {
            // Ensure directory exists
            await sandbox.process.start({
                cmd: 'sudo mkdir -p /app/s3'
            })

            // Write credentials file
            await sandbox.process.start({
                cmd: `echo "${process.env.AWS_ACCESS_KEY_ID}:${process.env.AWS_SECRET_ACCESS_KEY}" | sudo tee /etc/passwd-s3fs > /dev/null && sudo chmod 600 /etc/passwd-s3fs`
            })

            // Mount S3 with debug output
            await sandbox.process.start({
                cmd: `sudo s3fs "pyapps:/${user.id}" /app/s3 \
                    -o passwd_file=/etc/passwd-s3fs \
                    -o url="https://s3.amazonaws.com" \
                    -o endpoint=${process.env.AWS_REGION} \
                    -o allow_other \
                    -o umask=0000 \
                    -o dbglevel=info \
                    -o use_path_request_style \
                    -o default_acl=private \
                    -o use_cache=/tmp`,
                onStdout: (output: ProcessMessage) => {
                    console.log('Mount stdout:', output.line)
                },
                onStderr: (output: ProcessMessage) => {
                    console.error('Mount stderr:', output.line)
                }
            })

            // Verify mount
            const verifyMount = await sandbox.process.start({
                cmd: 'df -h | grep s3fs || echo "not mounted"'
            }) as Process & { text: string }
            
            if (verifyMount.text?.includes('not mounted')) {
                throw new Error('Failed to verify S3 mount')
            }
        }

        // Write and execute code
        console.log('Writing code to sandbox: ', codeContent)
        await sandbox.filesystem.write('/app/app.py', codeContent)

        console.log('Starting Streamlit process')
        const streamlitProcess = await sandbox.process.start({
            cmd: 'streamlit run /app/app.py',
            onStdout: (data: ProcessMessage) => console.log('Streamlit stdout:', data),
            onStderr: (data: ProcessMessage) => console.error('Streamlit stderr:', data),
        })

        // Keep sandbox alive
        await sandbox.keepAlive(2 * 60 * 1000) // 2 minutes

        const url = sandbox.getHostname(8501)
        console.log('Sandbox URL:', url)

        return NextResponse.json({ 
            url: `https://${url}`,
            sandboxId: sandbox.id 
        })
    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : 'An unknown error occurred'

        console.error('Sandbox execution error:', {
            error,
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
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

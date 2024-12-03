import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox, Process } from 'e2b'
import type { ProcessMessage } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
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
        const sandbox = await Sandbox.create({
            apiKey: process.env.E2B_API_KEY,
            template: 'streamlit-sandbox-s3',
        })

        // ensure the directory exists
        await sandbox.process.start({
            cmd: 'sudo mkdir -p /app/s3'
        })

        // write credentials file
        await sandbox.process.start({
            cmd: `echo "${process.env.AWS_ACCESS_KEY_ID}:${process.env.AWS_SECRET_ACCESS_KEY}" | sudo tee /etc/passwd-s3fs > /dev/null && sudo chmod 600 /etc/passwd-s3fs`
        })

        // mount S3 with debug output
        const mountResult = await sandbox.process.start({
            cmd: `sudo s3fs "pyapps:/${session.user.id}" /app/s3 \
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

        // verify mount
        const verifyMount = await sandbox.process.start({
            cmd: 'df -h | grep s3fs || echo "not mounted"'
        }) as Process & { text: string }

        if (verifyMount.text?.includes('not mounted')) {
            throw new Error('Failed to verify S3 mount')
        }

        await sandbox.keepAlive(2 * 60 * 1000)

        return NextResponse.json({ sandboxId: sandbox.id })
    } catch (error) {
        console.error('Sandbox initialization error:', error)
        return NextResponse.json(
            { error: 'Failed to initialize sandbox' },
            { status: 500 }
        )
    }
}

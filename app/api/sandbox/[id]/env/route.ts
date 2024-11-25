import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { envVars } = await req.json()
        const sandbox = await Sandbox.connect(params.id)

        // Set each environment variable
        for (const [key, value] of Object.entries(envVars)) {
            await sandbox.commands.run(
                `export ${key}="${value}"`,
                {
                    onStdout: (data: any) => console.log('Env var stdout:', data),
                    onStderr: (data: any) => console.error('Env var stderr:', data),
                }
            )
        }

        return NextResponse.json({ 
            message: 'Environment variables set successfully' 
        })
    } catch (error) {
        console.error('Error setting environment variables:', error)
        return NextResponse.json(
            { error: 'Failed to set environment variables' },
            { status: 500 }
        )
    }
}
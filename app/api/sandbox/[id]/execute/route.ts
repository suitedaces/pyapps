import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Sandbox } from '@/lib/sandbox'

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
        const { code } = await req.json()
        let sandbox;
        
        try {
            sandbox = await Sandbox.reconnect(params.id)
        } catch (error) {
            console.log('Failed to reconnect, creating new sandbox')
            sandbox = await Sandbox.create({
                userId: session.user.id,
                createdAt: new Date().toISOString()
            })
        }

        // Kill any existing Streamlit process
        await Sandbox.killProcess(sandbox, 'streamlit')

        // Install streamlit if not already installed
        try {
            await sandbox.commands.run('pip install streamlit')
        } catch (error) {
            console.error('Failed to install streamlit:', error)
        }

        // Write code to file
        await sandbox.files.write('/app/app.py', code)

        // Start Streamlit with retry logic
        let retries = 3
        let lastError = null

        while (retries > 0) {
            try {
                await sandbox.commands.run('streamlit run /app/app.py', {
                    onStdout: (data: string) => console.log('Streamlit stdout:', data),
                    onStderr: (data: string) => console.error('Streamlit stderr:', data),
                })
                
                // Wait for Streamlit to start
                await new Promise(resolve => setTimeout(resolve, 3000))
                
                const url = sandbox.getHost(8501)
                return NextResponse.json({ 
                    url: `https://${url}`,
                    sandboxId: sandbox.sandboxId,
                    message: "Streamlit app updated and running"
                })
            } catch (error) {
                lastError = error
                retries--
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }
            }
        }

        throw lastError || new Error('Failed to start Streamlit')
    } catch (error) {
        console.error('Error executing code:', error)
        return NextResponse.json(
            { error: 'Failed to execute code in sandbox' },
            { status: 500 }
        )
    }
}

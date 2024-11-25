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
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { code } = await req.json()

        // Verify this sandbox belongs to the user
        const userSandbox = Sandbox.getUserSandbox(session.user.id)
        if (!userSandbox || userSandbox.id !== params.id) {
            // Create new sandbox if invalid
            const newSandbox = await Sandbox.create(session.user.id)
            return NextResponse.json({ 
                sandboxId: newSandbox.sandboxId,
                needsReconnect: true 
            })
        }

        const sandbox = await Sandbox.connect(params.id)

        // Kill any existing processes
        await sandbox.commands.run('pkill -f streamlit || true')
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Write and run code
        await sandbox.files.write('/app/app.py', code)
        await sandbox.commands.run('streamlit run /app/app.py --server.port 8501')
        
        const url = `https://${sandbox.getHost(8501)}`
        return NextResponse.json({ url })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Failed to execute'
        }, { status: 500 })
    }
}

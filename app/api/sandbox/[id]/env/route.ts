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
        const { envVars } = await req.json()
        const sandbox = await Sandbox.connect(params.id)

        // Set environment variables
        for (const [key, value] of Object.entries(envVars)) {
            await sandbox.commands.run(`export ${key}="${value}"`)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Failed to set environment variables'
        }, { status: 500 })
    }
}
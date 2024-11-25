import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Sandbox } from '@/lib/sandbox'

export async function POST(req: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        // Check if user already has a sandbox
        const existing = Sandbox.getUserSandbox(session.user.id)
        if (existing) {
            return NextResponse.json({ sandboxId: existing.id })
        }

        // Create new sandbox
        const sandbox = await Sandbox.create(session.user.id)
        await sandbox.files.makeDir('/app')
        return NextResponse.json({ sandboxId: sandbox.sandboxId })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: 'Failed to initialize' }, { status: 500 })
    }
}

import { getUser } from '@/lib/supabase/server'
import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const sandboxId = req.nextUrl.pathname.split('/')[3]
    const sessionId = req.headers.get('x-session-id')
    const user = await getUser()

    try {
        const sandbox = await Sandbox.connect(sandboxId)

        // Verify ownership
        if (!user && !sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const metadata = (await Sandbox.list()).find(
            (s) => s.sandboxId === sandboxId
        )?.metadata as any
        if (
            (!user && metadata.sessionId !== sessionId) ||
            (user && metadata.userId !== user.id)
        ) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await sandbox.kill()
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error killing sandbox:', error)
        return NextResponse.json(
            { error: 'Failed to kill sandbox' },
            { status: 500 }
        )
    }
}

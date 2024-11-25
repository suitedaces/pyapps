import { Sandbox } from '@e2b/code-interpreter'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const { sandboxId } = await req.json()

    try {
        const sandbox = await Sandbox.connect(sandboxId)
        await sandbox.kill()

        return NextResponse.json({
            message: `Sandbox ${sandboxId} closed successfully`,
        })
    } catch (error) {
        console.error('Error closing sandbox:', error)
        return NextResponse.json(
            { error: 'Failed to close sandbox' },
            { status: 500 }
        )
    }
}

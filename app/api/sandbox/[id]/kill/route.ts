import { Sandbox } from 'e2b'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const { sandboxId } = await req.json()

    try {
        const sandbox = await Sandbox.reconnect(sandboxId)
        await sandbox.close()

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

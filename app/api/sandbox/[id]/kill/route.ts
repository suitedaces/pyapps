import { NextRequest, NextResponse } from 'next/server'
import { Sandbox } from 'e2b'

export async function POST(req: NextRequest) {
    const sandboxId = req.nextUrl.pathname.split('/')[3]

    try {
        const sandbox = await Sandbox.reconnect(sandboxId)
        await sandbox.close()
        
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error killing sandbox:', error)
        return NextResponse.json(
            { error: 'Failed to kill sandbox' },
            { status: 500 }
        )
    }
}

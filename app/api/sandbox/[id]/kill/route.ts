import { Sandbox } from 'e2b'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const sandboxId = req.nextUrl.pathname.split('/')[3]

    try {
        const sandbox = await Sandbox.reconnect(sandboxId)
        await sandbox.close()
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error killing sandbox:', error)
        return NextResponse.json({ success: false })
    }
}

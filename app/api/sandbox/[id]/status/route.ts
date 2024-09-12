import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Sandbox } from 'e2b'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const sandbox = await Sandbox.reconnect(params.id, process.env.E2B_API_KEY!)
    const status = await sandbox.getStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Error getting sandbox status:', error)
    return NextResponse.json({ error: 'Failed to get sandbox status' }, { status: 500 })
  }
}
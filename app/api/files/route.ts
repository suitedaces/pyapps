import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { file_name, file_type, file_size, file_url, backup_url, content_hash, analysis, expires_at } = await req.json()

  const { data, error } = await supabase
    .from('files')
    .insert({
      user_id: session.user.id,
      file_name,
      file_type,
      file_size,
      file_url,
      backup_url,
      content_hash,
      analysis,
      expires_at
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }

  return NextResponse.json(data)
}
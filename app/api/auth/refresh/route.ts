import { createClient } from '@/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.refreshSession()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ session: data.session, user: data.user })
}

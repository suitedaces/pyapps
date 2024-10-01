import { analyzeCSV } from '@/lib/csvAnalyzer'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    const { fileContent } = await req.json()

    try {
        const analysis = await analyzeCSV(fileContent)

        const { data, error } = await supabase
            .from('files')
            .update({ analysis, updated_at: new Date().toISOString() })
            .eq('id', params.id)
            .eq('user_id', session.user.id)
            .select()
            .single()

        if (error) {
            return NextResponse.json(
                { error: 'Failed to update file analysis' },
                { status: 500 }
            )
        }

        return NextResponse.json(analysis)
    } catch (error) {
        console.error('Error analyzing CSV:', error)
        return NextResponse.json(
            { error: 'Failed to analyze CSV' },
            { status: 500 }
        )
    }
}

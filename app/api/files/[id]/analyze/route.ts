import { analyzeCSV } from '@/lib/csvAnalyzer'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Analysis request validation schema
const AnalysisRequestSchema = z.object({
    fileContent: z.string().min(1),
    options: z
        .object({
            detailed: z.boolean().optional(),
            maxRows: z.number().min(1).max(1000).optional(),
        })
        .optional(),
})

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

    try {
        // Validate request body
        const body = await req.json()
        const { fileContent, options } =
            await AnalysisRequestSchema.parseAsync(body)

        // Fetch file metadata to verify ownership and type
        const { data: fileData, error: fileError } = await supabase
            .from('files')
            .select('*')
            .eq('id', params.id)
            .eq('user_id', session.user.id)
            .single()

        if (fileError || !fileData) {
            return NextResponse.json(
                { error: 'File not found or access denied' },
                { status: 404 }
            )
        }

        // Perform analysis based on file type
        let analysis = null
        if (fileData.file_type === 'csv') {
            analysis = await analyzeCSV(fileContent)
        } else {
            return NextResponse.json(
                { error: 'File type not supported for analysis' },
                { status: 400 }
            )
        }

        // Update file record with analysis results
        const { error: updateError } = await supabase
            .from('files')
            .update({
                analysis,
                updated_at: new Date().toISOString(),
            })
            .eq('id', params.id)
            .eq('user_id', session.user.id)

        if (updateError) throw updateError

        return NextResponse.json({
            id: params.id,
            analysis,
        })
    } catch (error) {
        console.error('Error analyzing file:', error)
        return NextResponse.json(
            {
                error:
                    error instanceof z.ZodError
                        ? 'Invalid analysis request'
                        : 'Failed to analyze file',
            },
            { status: 500 }
        )
    }
}

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateUUID } from '@/lib/utils'
import { analyzeFile } from '@/lib/fileAnalyzer'
import { createHash } from 'crypto'

// File metadata validation schema
const FileMetadataSchema = z.object({
    fileName: z.string().min(1),
    fileType: z.enum(['csv', 'json', 'txt']),
    fileSize: z.number().max(5 * 1024 * 1024), // 5MB limit
    chatId: z.string().optional(),
})

export async function GET(req: NextRequest) {
    console.log('📥 File list request received')
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        console.log('📋 Retrieved files:', {
            count: data.length
        })

        return NextResponse.json(data)
    } catch (error) {
        console.error('❌ Failed to fetch files:', error)
        return NextResponse.json(
            { error: 'Failed to fetch files' },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    console.log('📤 File upload request received')
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        console.log('❌ Unauthorized file upload attempt')
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            console.log('❌ No file provided in request')
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            )
        }

        console.log('📋 Processing file:', {
            name: file.name,
            type: file.type,
            size: file.size
        })

        // Validate file metadata
        const metadata = await FileMetadataSchema.parseAsync({
            fileName: file.name,
            fileType: file.name.split('.').pop()?.toLowerCase() as 'csv' | 'json' | 'txt',
            fileSize: file.size,
            chatId: formData.get('chatId')?.toString(),
        })

        // Read file content
        const fileContent = await file.text()

        // Generate content hash
        const contentHash = createHash('sha256')
            .update(fileContent)
            .digest('hex')

        // Generate file URLs
        const fileId = generateUUID()
        const fileUrl = `/files/${fileId}/${metadata.fileName}`
        const backupUrl = `/backup/files/${fileId}/${metadata.fileName}`

        // For CSV files, perform analysis
        let analysis = null
        if (metadata.fileType === 'csv') {
            console.log('📊 Analyzing CSV file')
            analysis = await analyzeFile(fileContent, 'csv', { detailed: true })
        }

        console.log('💾 Storing file metadata in database')
        // Store file metadata in Supabase
        const { data, error } = await supabase
            .from('files')
            .insert({
                id: fileId,
                user_id: session.user.id,
                chat_id: metadata.chatId,
                file_name: metadata.fileName,
                file_type: metadata.fileType,
                file_size: metadata.fileSize,
                file_url: fileUrl,
                backup_url: backupUrl,
                content_hash: contentHash,
                analysis,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
            })
            .select()
            .single()

        if (error) {
            console.error('❌ Database error:', error)
            throw error
        }

        console.log('✅ File upload completed:', {
            fileId,
            fileName: metadata.fileName,
            fileType: metadata.fileType
        })

        return NextResponse.json({
            id: fileId,
            fileName: metadata.fileName,
            fileType: metadata.fileType,
            analysis,
        })

    } catch (error) {
        console.error('❌ Error handling file upload:', error)
        return NextResponse.json(
            {
                error: error instanceof z.ZodError
                    ? 'Invalid file data'
                    : 'Failed to upload file'
            },
            { status: 500 }
        )
    }
}

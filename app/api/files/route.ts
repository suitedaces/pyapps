import { analyzeCSV } from '@/lib/fileAnalyzer'
import {
    initiateMultipartUpload,
    uploadPart,
    completeMultipartUpload,
    abortMultipartUpload,
    BUCKET_NAME
} from '@/lib/s3'
import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from '@/lib/s3'

// File metadata validation schema
const FileMetadataSchema = z.object({
    fileName: z.string().min(1),
    fileType: z.enum(['csv', 'json', 'txt']),
    fileSize: z.number().max(500 * 1024 * 1024), // 500MB limit
    chatId: z.string().optional(),
})

// Multipart upload initialization schema
const InitUploadSchema = z.object({
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
    chatId: z.string().optional(),
})

// Part upload schema
const PartUploadSchema = z.object({
    uploadId: z.string(),
    partNumber: z.number(),
    key: z.string(),
})

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch files' },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    // Check if this is a multipart upload initialization
    const contentType = req.headers.get('content-type')
    if (contentType?.includes('application/json')) {
        try {
            const body = await req.json()
            const { fileName, fileType, fileSize, chatId } = await InitUploadSchema.parseAsync(body)

            // Validate file metadata
            await FileMetadataSchema.parseAsync({
                fileName,
                fileType: fileType as 'csv' | 'json' | 'txt',
                fileSize,
                chatId,
            })

            // Generate S3 key
            const s3Key = `${user.id}/data/${fileName}`

            // Check for existing file with same name
            const { data: existingFile } = await supabase
                .from('files')
                .select('id, s3_key, upload_id')
                .eq('user_id', user.id)
                .eq('file_name', fileName)
                .single()

            let fileId;
            
            // If file exists, update its details
            if (existingFile) {
                // Abort any existing upload
                if (existingFile.upload_id) {
                    try {
                        await abortMultipartUpload(existingFile.s3_key, existingFile.upload_id)
                    } catch (error) {
                        console.error('Failed to abort existing upload:', error)
                    }
                }

                fileId = existingFile.id;

                // Update existing file record
                const { error: updateError } = await supabase
                    .from('files')
                    .update({
                        file_type: fileType,
                        file_size: fileSize,
                        s3_key: s3Key,
                        upload_status: 'pending',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingFile.id)

                if (updateError) throw updateError
            } else {
                // Create new file record if doesn't exist
                const { data: fileData, error: dbError } = await supabase
                    .from('files')
                    .insert({
                        user_id: user.id,
                        file_name: fileName,
                        file_type: fileType,
                        file_size: fileSize,
                        s3_key: s3Key,
                        upload_status: 'pending'
                    })
                    .select()
                    .single()

                if (dbError) throw dbError
                fileId = fileData.id
            }

            // Initiate new multipart upload
            const uploadId = await initiateMultipartUpload(s3Key, `text/${fileType}`)

            // Update the upload_id
            await supabase
                .from('files')
                .update({ upload_id: uploadId })
                .eq('id', fileId)

            // If chatId provided and file is new, create association
            if (chatId && !existingFile) {
                await supabase.from('chat_files').insert({
                    chat_id: chatId,
                    file_id: fileId,
                })
            }

            return NextResponse.json({
                uploadId,
                key: s3Key,
                fileId: fileId,
                existingFileId: existingFile?.id
            })
        } catch (error) {
            console.error('Failed to initialize upload:', error)
            return NextResponse.json(
                { error: 'Failed to initialize upload' },
                { status: 500 }
            )
        }
    }

    // Handle part upload
    if (contentType?.includes('multipart/form-data')) {
        try {
            const formData = await req.formData()
            const uploadId = formData.get('uploadId') as string
            const partNumber = parseInt(formData.get('partNumber') as string)
            const key = formData.get('key') as string
            const file = formData.get('file') as File

            if (!uploadId || !partNumber || !key || !file) {
                return NextResponse.json(
                    { error: 'Missing required fields' },
                    { status: 400 }
                )
            }

            await PartUploadSchema.parseAsync({ uploadId, partNumber, key })

            const chunk = Buffer.from(await file.arrayBuffer())
            const partResult = await uploadPart(key, uploadId, partNumber, chunk)

            return NextResponse.json(partResult)
        } catch (error) {
            console.error('Failed to upload part:', error)
            return NextResponse.json(
                { error: 'Failed to upload part' },
                { status: 500 }
            )
        }
    }

    return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
    )
}

// Complete multipart upload
export async function PATCH(req: NextRequest) {
    const user = await getUser()
    const supabase = await createClient()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { uploadId, key, parts, fileId } = await req.json()

        // Complete the multipart upload
        const s3Url = await completeMultipartUpload(key, uploadId, parts)

        // Get file info for analysis
        const { data: fileInfo } = await supabase
            .from('files')
            .select('file_name, file_type')
            .eq('id', fileId)
            .single()

        if (!fileInfo) {
            throw new Error('File info not found')
        }

        // Perform analysis for CSV files
        let analysis = null
        if (fileInfo.file_type === 'csv') {
            // Get file content from S3
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            })
            const response = await s3Client.send(command)
            const fileContent = await response.Body!.transformToString()
            
            analysis = await analyzeCSV(fileContent, {
                sampleSize: 1000,
                maxRows: 5,
            })
        }

        // Update file status and analysis in database
        const { error: dbError } = await supabase
            .from('files')
            .update({
                upload_status: 'completed',
                analysis: analysis ? JSON.stringify(analysis) : undefined,
                updated_at: new Date().toISOString(),
            })
            .eq('id', fileId)
            .eq('user_id', user.id)

        if (dbError) throw dbError

        return NextResponse.json({ url: s3Url })
    } catch (error) {
        console.error('Failed to complete upload:', error)
        return NextResponse.json(
            { error: 'Failed to complete upload' },
            { status: 500 }
        )
    }
}

// Abort multipart upload
export async function DELETE(req: NextRequest) {
    const user = await getUser()
    const supabase = await createClient()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { uploadId, key, fileId } = await req.json()

        // Abort the multipart upload
        await abortMultipartUpload(key, uploadId)

        // Update file status in database
        const { error: dbError } = await supabase
            .from('files')
            .update({
                upload_status: 'failed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', fileId)
            .eq('user_id', user.id)

        if (dbError) throw dbError

        return NextResponse.json({ message: 'Upload aborted successfully' })
    } catch (error) {
        console.error('Failed to abort upload:', error)
        return NextResponse.json(
            { error: 'Failed to abort upload' },
            { status: 500 }
        )
    }
}

// Add PUT endpoint for updating chat file associations
export async function PUT(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { oldFileId, newFileId, chatId } = await req.json()

        // Update all chat associations from old file to new file
        if (oldFileId && newFileId) {
            await supabase
                .from('chat_files')
                .update({ file_id: newFileId })
                .eq('file_id', oldFileId)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update file associations:', error)
        return NextResponse.json(
            { error: 'Failed to update file associations' },
            { status: 500 }
        )
    }
}

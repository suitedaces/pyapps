import { useCallback, useState } from 'react'
import { analyzeCSV } from '@/lib/fileAnalyzer'
import { createClient } from '@/lib/supabase/client'
import { CHUNK_SIZE } from '@/lib/s3'
import { useAuth } from '@/contexts/AuthContext'

interface UploadOptions {
    file: File
    chatId?: string
    onProgress?: (progress: number) => void
}

interface UploadResult {
    fileId: string
    url: string
}

export function useFileUpload() {
    const [isUploading, setIsUploading] = useState(false)
    const supabase = createClient()
    const { session } = useAuth()

    const uploadFile = useCallback(async ({ file, chatId, onProgress }: UploadOptions): Promise<UploadResult> => {
        if (!session?.user?.id) {
            throw new Error('User not authenticated')
        }

        setIsUploading(true)
        try {
            // Check for existing file with same name
            const { data: existingFile } = await supabase
                .from('files')
                .select('id, s3_key, upload_id')
                .eq('user_id', session.user.id)
                .eq('file_name', file.name)
                .single()

            // Step 1: Initialize multipart upload
            const initResponse = await fetch('/api/s3-presign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-upload-action': 'init'
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type.split('/')[1] || 'txt',
                    fileSize: file.size,
                    chatId
                })
            })

            if (!initResponse.ok) throw new Error('Failed to initialize upload')
            const { uploadId, key } = await initResponse.json()

            // Step 2: Upload parts in parallel
            const chunks: Blob[] = []
            const maxChunks = 10000 // S3 limit for multipart upload parts
            const chunkSize = Math.max(5 * 1024 * 1024, Math.ceil(file.size / maxChunks))
            let completedChunks = 0
            
            for (let i = 0; i < file.size; i += chunkSize) {
                const end = Math.min(i + chunkSize, file.size)
                chunks.push(file.slice(i, end))
            }

            const parts = await Promise.all(
                chunks.map(async (chunk, index) => {
                    // Get presigned URL for this part
                    const presignResponse = await fetch('/api/s3-presign', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-upload-action': 'presign-part'
                        },
                        body: JSON.stringify({
                            key,
                            uploadId,
                            partNumber: index + 1
                        })
                    })

                    if (!presignResponse.ok) throw new Error('Failed to get presigned URL')
                    const { presignedUrl } = await presignResponse.json()

                    // Upload the part
                    const uploadResponse = await fetch(presignedUrl, {
                        method: 'PUT',
                        body: chunk
                    })

                    if (!uploadResponse.ok) throw new Error('Failed to upload part')
                    const ETag = uploadResponse.headers.get('ETag')?.replace(/"/g, '')
                    
                    completedChunks++
                    onProgress?.(Math.min((completedChunks / chunks.length) * 100, 99)) // Cap at 99% until fully complete
                    
                    return {
                        PartNumber: index + 1,
                        ETag
                    }
                })
            )

            // Set progress to 100% after all parts are complete and upload is finalized
            onProgress?.(100)

            // Step 3: Complete multipart upload
            const completeResponse = await fetch('/api/s3-presign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-upload-action': 'complete'
                },
                body: JSON.stringify({
                    key,
                    uploadId,
                    parts
                })
            })

            if (!completeResponse.ok) throw new Error('Failed to complete upload')
            const { url } = await completeResponse.json()

            // Step 4: Analyze file if it's a CSV
            let analysis = null
            if (file.type === 'text/csv') {
                const text = await file.text()
                analysis = await analyzeCSV(text, {
                    sampleSize: 1000,
                    maxRows: 5
                })
            }

            let fileData;
            // Step 5: Create or update file record in Supabase
            if (existingFile) {
                // Update existing file
                const { data: updatedFile, error: updateError } = await supabase
                    .from('files')
                    .update({
                        file_type: file.type.split('/')[1] || 'txt',
                        file_size: file.size,
                        s3_key: key,
                        upload_status: 'completed',
                        analysis: analysis ? JSON.stringify(analysis) : null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingFile.id)
                    .select()
                    .single()

                if (updateError) throw updateError
                fileData = updatedFile
            } else {
                // Create new file record
                const { data: newFile, error: insertError } = await supabase
                    .from('files')
                    .insert({
                        user_id: session.user.id,
                        file_name: file.name,
                        file_type: file.type.split('/')[1] || 'txt',
                        file_size: file.size,
                        s3_key: key,
                        upload_status: 'completed',
                        analysis: analysis ? JSON.stringify(analysis) : null
                    })
                    .select()
                    .single()

                if (insertError) throw insertError
                fileData = newFile
            }

            return {
                fileId: fileData.id,
                url
            }

        } catch (error) {
            console.error('Upload error:', error)
            throw error
        } finally {
            setIsUploading(false)
        }
    }, [supabase, session])

    return {
        uploadFile,
        isUploading
    }
} 
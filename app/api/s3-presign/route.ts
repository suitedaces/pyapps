import { getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { s3Client, BUCKET_NAME } from '@/lib/s3'
import { 
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand 
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const InitUploadSchema = z.object({
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
    chatId: z.string().optional(),
})

const PartPresignSchema = z.object({
    key: z.string(),
    uploadId: z.string(),
    partNumber: z.number(),
})

const CompleteUploadSchema = z.object({
    key: z.string(),
    uploadId: z.string(),
})

export async function POST(req: NextRequest) {
    const user = await getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const action = req.headers.get('x-upload-action')

    try {
        switch (action) {
            case 'init': {
                const { fileName, fileType, fileSize, chatId } = await InitUploadSchema.parseAsync(body)
                const key = `${user.id}/data/${fileName}`

                const command = new CreateMultipartUploadCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    ContentType: `text/${fileType}`,
                })

                const { UploadId } = await s3Client.send(command)
                return NextResponse.json({ uploadId: UploadId, key })
            }

            case 'presign-part': {
                const { key, uploadId, partNumber } = await PartPresignSchema.parseAsync(body)
                
                const command = new UploadPartCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    UploadId: uploadId,
                    PartNumber: partNumber,
                })

                const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
                return NextResponse.json({ presignedUrl })
            }

            case 'complete': {
                const { key, uploadId } = await CompleteUploadSchema.parseAsync(body)
                
                const command = new CompleteMultipartUploadCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    UploadId: uploadId,
                    MultipartUpload: {
                        Parts: body.parts,
                    },
                })

                await s3Client.send(command)
                return NextResponse.json({ 
                    url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}` 
                })
            }

            case 'abort': {
                const { key, uploadId } = await CompleteUploadSchema.parseAsync(body)
                
                const command = new AbortMultipartUploadCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    UploadId: uploadId,
                })

                await s3Client.send(command)
                return NextResponse.json({ success: true })
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }
    } catch (error) {
        console.error('S3 presign error:', error)
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
    }
} 
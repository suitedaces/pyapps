import { NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
})

export async function GET(
    request: Request,
    { params }: { params: Promise<{ appId: string; versionNumber: string }> }
) {
    try {
        const { appId, versionNumber } = await params
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        
        if (!userId) {
            return new NextResponse('Missing userId parameter', { status: 400 })
        }
        
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: `${userId}/apps/${appId}/${versionNumber}/preview.png`
        })
        console.log
        console.log('Generating presigned URL for key:', command.input.Key);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) // URL expires in 1 hour

        return NextResponse.json({ url })
    } catch (error) {
        console.error('Error generating presigned URL:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
} 
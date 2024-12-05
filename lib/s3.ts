import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET!

export async function uploadToS3(file: Buffer, key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType
  })

  await s3Client.send(command)
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

export async function getSignedDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  })

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
}

export async function deleteFromS3(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  })

  await s3Client.send(command)
}

export function getUserFileKey(userId: string, fileId: string, fileName: string): string {
  return `${userId}/files/${fileId}/${fileName}`;
}

export function getUserAppKey(userId: string, appId: string, version: string): string {
  return `${userId}/apps/${appId}/code/app_v${version}.py`;
}

export async function getFileFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  })

  const response = await s3Client.send(command)
  const byteArray = await response.Body!.transformToByteArray()
  return Buffer.concat([Buffer.from(byteArray)])
}

export const getS3Key = (userId: string, fileName: string): string => {
    return `${userId}/data/${fileName}`;
};
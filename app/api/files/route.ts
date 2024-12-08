import { analyzeFile } from '@/lib/fileAnalyzer'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { uploadToS3 } from '@/lib/s3'

// File metadata validation schema
const FileMetadataSchema = z.object({
    fileName: z.string().min(1),
    fileType: z.enum(['csv', 'json', 'txt']),
    fileSize: z.number().max(5 * 1024 * 1024), // 5MB limit
    chatId: z.string().optional(),
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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const chatId = formData.get('chatId')?.toString();

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 1. Validate file metadata
        const metadata = await FileMetadataSchema.parseAsync({
            fileName: file.name,
            fileType: file.name.split('.').pop()?.toLowerCase() as 'csv' | 'json' | 'txt',
            fileSize: file.size,
            chatId: chatId,
        });

        const fileContent = await file.text();
        
        // 2. Upload to S3
        const s3Key = `${session.user.id}/data/${metadata.fileName}`;
        await uploadToS3(Buffer.from(fileContent), s3Key, `text/${metadata.fileType}`);

        // 3. Analyze file if CSV
        let analysis = null;
        if (metadata.fileType === 'csv') {
            analysis = await analyzeFile(fileContent, 'csv', { detailed: true });
        }

        // 4. Store file record
        const { data: fileData, error: fileError } = await supabase
            .from('files')
            .insert({
                user_id: session.user.id,
                file_name: metadata.fileName,
                file_type: metadata.fileType,
                file_size: metadata.fileSize,
                s3_key: s3Key,
                analysis,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                last_accessed: new Date().toISOString(),
            })
            .select()
            .single();

        if (fileError) throw fileError;

        // 5. Link file to chat if chatId provided
        if (chatId) {
            await supabase
                .from('chat_files')
                .insert({
                    chat_id: chatId,
                    file_id: fileData.id,
                    created_at: new Date().toISOString(),
                });
        }

        return NextResponse.json(fileData);
    } catch (error) {
        console.error('Failed to upload file:', error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}

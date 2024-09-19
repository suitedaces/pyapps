import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Sandbox } from 'e2b'

export async function GET(req: NextRequest) {
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

    console.log(`Fetching files for user ID: ${session.user.id}`);
    const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Failed to fetch files:', error);
        return NextResponse.json(
            { error: 'Failed to fetch files' },
            { status: 500 }
        )
    }

    console.log(`Successfully fetched ${data.length} files for user ID: ${session.user.id}`);
    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        console.warn('Unauthorized access attempt');
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    const {
        chat_id,
        file_name,
        file_type,
        file_size,
        file_url,
        backup_url,
        content_hash,
        analysis,
        expires_at,
        sandbox_id,
    } = await req.json()

    console.log(`Inserting file metadata for user ID: ${session.user.id}, file name: ${file_name}`);
    const { data, error } = await supabase
        .from('files')
        .insert({
            user_id: session.user.id,
            chat_id,
            file_name,
            file_type,
            file_size,
            file_url,
            backup_url,
            content_hash,
            analysis,
            expires_at,
        })
        .select()
        .single()

    if (error) {
        console.error('Error inserting file metadata:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        )
    }
    
    console.log(`File metadata inserted with data: ${data}`);

    // Upload file to E2B sandbox
    try {
        const sandbox = await Sandbox.reconnect(sandbox_id);
        const fileBuffer = Buffer.from(content_hash);
        const remotePath = await sandbox.uploadFile(fileBuffer, `app/${file_name}`);

        console.log(`File uploaded to sandbox at: ${remotePath}`);
        return NextResponse.json({ ...data, remotePath });

    } catch (e2bError) {
        console.error('Error uploading file to E2B sandbox:', e2bError);
        return NextResponse.json(
            { error: 'Failed to upload file to E2B sandbox' },
            { status: 500 }
        );
    }
}
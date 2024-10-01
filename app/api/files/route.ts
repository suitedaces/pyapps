import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

    console.log(`Fetching files for user ID: ${session.user.id}`)
    const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Failed to fetch files:', error)
        return NextResponse.json(
            { error: 'Failed to fetch files' },
            { status: 500 }
        )
    }

    console.log(
        `Successfully fetched ${data.length} files for user ID: ${session.user.id}`
    )
    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
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

    const {
        chat_id,
        app_id,
        file_name,
        file_type,
        file_size,
        file_url,
        backup_url,
        content_hash,
        analysis,
        sandbox_id,
    } = await req.json()

    // Insert file information into the files table
    const { data: fileData, error: fileError } = await supabase
        .from('files')
        .insert({
            user_id: session.user.id,
            file_name,
            file_type,
            file_size,
            file_url,
            backup_url,
            content_hash,
            analysis,
        })
        .select()
        .single()

    if (fileError) {
        console.error('Error inserting file:', fileError)
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        )
    }

    // Associate file with chat
    if (chat_id) {
        const { error: chatFileError } = await supabase
            .from('chat_files')
            .insert({
                chat_id,
                file_id: fileData.id,
            })

        if (chatFileError) {
            console.error('Error associating file with chat:', chatFileError)
        }
    }

    // Associate file with app (if applicable)
    if (app_id) {
        const { error: appFileError } = await supabase
            .from('app_files')
            .insert({
                app_id,
                file_id: fileData.id,
            })

        if (appFileError) {
            console.error('Error associating file with app:', appFileError)
        }
    }

    // Upload file to E2B sandbox
    try {
        const sandbox = await Sandbox.reconnect(sandbox_id)
        const fileBuffer = Buffer.from(content_hash)
        const remotePath = await sandbox.uploadFile(
            fileBuffer,
            `${file_name}`
        )

        console.log(`File uploaded to sandbox at: ${remotePath}`)
        return NextResponse.json({ ...fileData, remotePath })
    } catch (e2bError) {
        console.error('Error uploading file to E2B sandbox:', e2bError)
        return NextResponse.json(
            { error: 'Failed to upload file to E2B sandbox' },
            { status: 500 }
        )
    }
}

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox } from 'e2b'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

    const { chat_id, app_id } = await req.json()

    try {
        const sandbox = await Sandbox.create({
            apiKey: process.env.E2B_API_KEY,
            template: 'streamlit-sandbox-me',
        })

        await sandbox.filesystem.makeDir('/app')
        await sandbox.keepAlive(10 * 60 * 1000) // 10 minutes

        // Retrieve associated files
        let files: any[] = []
        if (chat_id) {
            const { data: chatFiles, error: chatFilesError } = await supabase
                .from('chat_files')
                .select('files(*)')
                .eq('chat_id', chat_id)

            if (chatFilesError) {
                console.error('Error fetching chat files:', chatFilesError)
            } else {
                files = chatFiles.map((cf) => cf.files)
            }
        }
        if (app_id) {
            const { data: appFiles, error: appFilesError } = await supabase
                .from('app_files')
                .select('files(*)')
                .eq('app_id', app_id)

            if (appFilesError) {
                console.error('Error fetching app files:', appFilesError)
            } else {
                files = [...files, ...appFiles.map((af) => af.files)]
            }
        }

        // Upload files to sandbox
        for (const file of files) {
            const fileBuffer = Buffer.from(file.content_hash)
            await sandbox.uploadFile(fileBuffer, `${file.file_name}`)
        }

        return NextResponse.json({ sandboxId: sandbox.id, files })
    } catch (error) {
        console.error('Error initializing sandbox:', error)
        return NextResponse.json(
            { error: 'Failed to initialize sandbox' },
            { status: 500 }
        )
    }
}

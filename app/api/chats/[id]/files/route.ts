import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

interface RouteContext {
    params: { id: string }
}

// Validation schema
const FileAssociationSchema = z.object({
    fileIds: z.array(z.string()),
})

export async function POST(
    req: NextRequest,
    context: RouteContext
) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json()
        const { fileIds } = await FileAssociationSchema.parseAsync(body)

        // Verify chat ownership
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', context.params.id)
            .eq('user_id', user.id)
            .single()

        if (chatError || !chat) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            )
        }

        // Delete existing associations
        await supabase
            .from('chat_files')
            .delete()
            .eq('chat_id', context.params.id)

        // Create new associations
        if (fileIds.length > 0) {
            const { error } = await supabase.from('chat_files').insert(
                fileIds.map((fileId) => ({
                    chat_id: context.params.id,
                    file_id: fileId,
                }))
            )

            if (error) throw error
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

export async function GET(
    req: NextRequest,
    context: RouteContext
) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        // First verify chat ownership
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', context.params.id)
            .eq('user_id', user.id)
            .single()

        if (chatError || !chat) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            )
        }

        const { data, error } = await supabase
            .from('chat_files')
            .select(
                `
                file_id,
                files (
                    id,
                    file_name,
                    file_type,
                    created_at
                )
            `
            )
            .eq('chat_id', context.params.id)

        if (error) throw error

        const files = data
            .map((row: any) => row.files)
            .filter((file: any) => file !== null)

        return NextResponse.json(files)
    } catch (error) {
        console.error('Failed to fetch chat files:', error)
        return NextResponse.json(
            { error: 'Failed to fetch chat files' },
            { status: 500 }
        )
    }
} 
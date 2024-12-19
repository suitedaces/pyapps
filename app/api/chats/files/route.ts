import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const ChatFileSchema = z.object({
    chatId: z.string().min(1),
    fileId: z.string().min(1),
})

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { chatId, fileId } = await ChatFileSchema.parseAsync(await req.json())

        // First verify the file exists and belongs to user
        const { data: fileExists } = await supabase
            .from('files')
            .select('id')
            .eq('id', fileId)
            .eq('user_id', user.id)
            .single()

        if (!fileExists) {
            console.error('File not found or unauthorized')
            return NextResponse.json(
                { error: 'File not found or unauthorized' },
                { status: 404 }
            )
        }

        // Create chat-file association
        const { data, error } = await supabase
            .from('chat_files')
            .insert({
                chat_id: chatId,
                file_id: fileId,
                created_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            console.error('Error associating file with chat:', error)
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Failed to create chat-file association:', error)
        return NextResponse.json(
            { error: 'Failed to create chat-file association' },
            { status: 500 }
        )
    }
}

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    // Get chatId from URL search params instead of body
    const searchParams = req.nextUrl.searchParams
    const chatId = searchParams.get('chatId')

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    if (!chatId) {
        return NextResponse.json(
            { error: 'Chat ID is required' },
            { status: 400 }
        )
    }

    try {
        const { data, error } = await supabase
            .from('chat_files')
            .select('*')
            .eq('chat_id', chatId)

        if (error) throw error

        return NextResponse.json({ files: data })
    } catch (error) {
        console.error('Failed to fetch chat files:', error)
        return NextResponse.json(
            { error: 'Failed to fetch chat files' },
            { status: 500 }
        )
    }
}

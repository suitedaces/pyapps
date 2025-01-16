import { createClient, getUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const FileAssociationSchema = z.object({
    chatId: z.string(),
    fileId: z.string(),
})

export async function POST(req: Request) {
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
        const { chatId, fileId } = await FileAssociationSchema.parseAsync(body)

        // Verify chat ownership
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', chatId)
            .eq('user_id', user.id)
            .single()

        if (chatError || !chat) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            )
        }

        // Create new association
        const { error } = await supabase
            .from('chat_files')
            .insert({
                chat_id: chatId,
                file_id: fileId,
            })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to link file to chat:', error)
        return NextResponse.json(
            { error: 'Failed to link file to chat' },
            { status: 500 }
        )
    }
} 
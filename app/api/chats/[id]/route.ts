import { createClient, getUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: chat, error } = await supabase
        .from('chats')
        .select(
            `
            *,
            app:app_id (
                id
            )
        `
        )
        .eq('id', id)
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch chat' },
            { status: 500 }
        )
    }

    return NextResponse.json({ chat })
}

export async function DELETE(request: Request, context: RouteContext) {
    const { id } = await context.params
    const user = await getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    try {
        // 1. Verify chat ownership and get app_id
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('app_id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (chatError) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            )
        }

        // 2. If chat has an app, handle app cleanup
        if (chat.app_id) {
            // First, clear current_version_id from app
            const { error: updateError } = await supabase
                .from('apps')
                .update({ current_version_id: null })
                .eq('id', chat.app_id)
                .eq('user_id', user.id)

            if (updateError) throw updateError

            // Then clear app_id from chat to remove the foreign key constraint
            const { error: chatUpdateError } = await supabase
                .from('chats')
                .update({ app_id: null })
                .eq('id', id)
                .eq('user_id', user.id)

            if (chatUpdateError) throw chatUpdateError
        }

        // 3. Delete all related data in sequence
        // Delete messages
        const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .eq('chat_id', id)

        if (messagesError) throw messagesError

        // Delete chat-file associations
        const { error: chatFilesError } = await supabase
            .from('chat_files')
            .delete()
            .eq('chat_id', id)

        if (chatFilesError) throw chatFilesError

        // Delete app-related data if needed
        if (chat.app_id) {
            // Delete app versions
            const { error: versionsError } = await supabase
                .from('app_versions')
                .delete()
                .eq('app_id', chat.app_id)

            if (versionsError) throw versionsError

            // Delete the app
            const { error: appError } = await supabase
                .from('apps')
                .delete()
                .eq('id', chat.app_id)
                .eq('user_id', user.id)

            if (appError) throw appError
        }

        // Finally delete the chat itself
        const { error: deleteError } = await supabase
            .from('chats')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (deleteError) throw deleteError

        return NextResponse.json({
            message: 'Chat and related data deleted successfully',
        })
    } catch (error) {
        console.error('Delete error:', error)
        return NextResponse.json(
            { error: 'Failed to delete chat and related data' },
            { status: 500 }
        )
    }
}

import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { fileId, fileIds } = await request.json()
    const { id } = await params

    try {
        if (fileId) {
            // Single file association
            const { error } = await supabase
                .from('chat_files')
                .insert({ chat_id: id, file_id: fileId })
            if (error) throw error
        } else if (fileIds) {
            // Multiple file associations
            const { error } = await supabase
                .from('chat_files')
                .insert(fileIds.map((id: string) => ({ 
                    chat_id: id, 
                    file_id: id 
                })))
            if (error) throw error
        }
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error linking file:', error)
        return NextResponse.json({ error: 'Failed to link file' }, { status: 500 })
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { fileIds } = await request.json()
    const { id } = await params

    try {
        // First delete existing associations
        const { error: deleteError } = await supabase
            .from('chat_files')
            .delete()
            .eq('chat_id', id)
        
        if (deleteError) throw deleteError

        // Then create new associations if fileIds is not empty
        if (fileIds && fileIds.length > 0) {
            const { error: insertError } = await supabase
                .from('chat_files')
                .insert(fileIds.map((fileId: string) => ({ 
                    chat_id: id,
                    file_id: fileId,
                    created_at: new Date().toISOString()
                })))
            if (insertError) throw insertError
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating file associations:', error)
        return NextResponse.json(
            { error: 'Failed to update file associations' }, 
            { status: 500 }
        )
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { id } = await params

    try {
        const { error } = await supabase
            .from('chat_files')
            .delete()
            .eq('chat_id', id)
        
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting file associations:', error)
        return NextResponse.json(
            { error: 'Failed to delete file associations' }, 
            { status: 500 }
        )
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const user = await getUser()
    const { id } = await params

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
            .eq('id', id)
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
            .eq('chat_id', id)

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
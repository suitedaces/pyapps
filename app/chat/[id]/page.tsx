import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ChatContainer from '@/components/ChatContainer'
import { formatDatabaseMessages } from '@/lib/utils'
import { AppVersion } from '@/lib/types'

interface PageParams {
    params: Promise<{ id: string }>
}

export default async function ChatPage({ params }: PageParams) {
    const { id } = await params
    const user = await getUser()
    
    if (!user) {
        notFound()
    }

    const supabase = await createClient()

    // Parallel fetch of chat, messages, versions, and associated files
    const [chatResponse, messagesResponse, versionResponse, filesResponse] = await Promise.all([
        supabase
            .from('chats')
            .select('*')
            .eq('id', id)
            .single(),
        supabase
            .from('messages')
            .select('*')
            .eq('chat_id', id)
            .order('created_at', { ascending: true }),
        (supabase
            .rpc('get_chat_current_app_version', { p_chat_id: id })
            .single()) as unknown as Promise<{ data: AppVersion[]; error: any }>,
        // Fetch associated files through chat_files junction table
        supabase
            .from('chat_files')
            .select(`
                files (
                    id,
                    file_name,
                    file_type,
                    analysis,
                    created_at
                )
            `)
            .eq('chat_id', id)
    ])
    console.log('chatResponse', chatResponse)
    console.log('messagesResponse', messagesResponse)
    console.log('versionResponse', versionResponse)
    console.log('filesResponse', filesResponse)

    if (chatResponse.error || !chatResponse.data) {
        console.error('Error fetching chat:', chatResponse.error)
        notFound()
    }

    if (messagesResponse.error) {
        console.error('Error fetching messages:', messagesResponse.error)
        notFound()
    }

    // Extract files from the response
    const files = filesResponse.data
        ?.map(row => row.files)
        .filter((file): file is NonNullable<typeof file> => file !== null)
        .map(file => ({
            ...file,
            analysis: file.analysis as string | null
        })) ?? []

    const messages = formatDatabaseMessages(messagesResponse.data ?? [])

    return <ChatContainer 
        initialChat={chatResponse.data} 
        initialMessages={messages} 
        initialVersion={versionResponse.data}
        initialFiles={files}
        initialAppId={chatResponse.data.app_id}
        isInChatPage={true} 
    />
}
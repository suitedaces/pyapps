import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ChatContainer from '@/components/ChatContainer'
import { Database } from '@/lib/database.types'
import { formatDatabaseMessages } from '@/lib/utils'

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

    console.log('User id:', user.id)
    // Parallel fetch of chat, messages, and current version
    const [chatResponse, messagesResponse, versionResponse] = await Promise.all([
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
        supabase
            .rpc('get_chat_current_app_version', { p_chat_id: id })
    ])

    console.log('chatResponse', chatResponse)
    console.log('messagesResponse', messagesResponse)
    console.log('versionResponse', versionResponse)

    if (chatResponse.error || !chatResponse.data) {
        console.error('Error fetching chat:', chatResponse.error)
        notFound()
    }

    if (messagesResponse.error) {
        console.error('Error fetching messages:', messagesResponse.error)
        notFound()
    }

    const messages = formatDatabaseMessages(messagesResponse.data ?? [])

    return <ChatContainer 
        initialChat={chatResponse.data} 
        initialMessages={messages} 
        initialVersion={versionResponse.data ?? null}
        isInChatPage={true} 
    />
}
import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ChatContainer from '@/components/ChatContainer'

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
    const { data: chat, error } = await supabase
        .from('chats')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (error || !chat) {
        notFound()
    }

    // Fetch messages for initial state
    const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .order('created_at', { ascending: true })

    return <ChatContainer 
        initialChat={chat} 
        initialMessages={messages} 
        isInChatPage={true} 
    />
}
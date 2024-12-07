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

    return <ChatContainer initialChat={chat} isInChatPage={true} />
}

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { notFound } from 'next/navigation'
import ChatContainer from '@/components/ChatContainer'

export interface ChatPageProps {
    initialChat: any
}

export default async function ChatPage({
    params: { id },
}: {
    params: { id: string }
}) {
    const supabase = createClientComponentClient()

    // We only need to fetch the chat data here
    const { data: chat, error } = await supabase
        .from('chats')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !chat) {
        notFound()
    }

    return <ChatContainer initialChat={chat} />
}
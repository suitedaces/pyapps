import { notFound } from 'next/navigation'
import ChatPageClient from './ChatPageClient'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export default async function ChatIdPage({
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

    return <ChatPageClient initialChat={chat} />
}

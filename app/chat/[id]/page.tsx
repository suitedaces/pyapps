import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import ChatPageClient from './ChatPageClient'

export default async function ChatIdPage({
    params: { id },
}: {
    params: { id: string }
}) {
    const supabase = createServerComponentClient({ cookies })

    const {
        data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
        redirect('/login')
    }

    const { data: chat, error } = await supabase
        .from('chats')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !chat) {
        notFound()
    }

    return <ChatPageClient initialChat={chat} initialSession={session} />
}

import ChatContainer from '@/components/ChatContainer'
import LoadingAnimation from '@/components/LoadingAnimation'
import { createClient, getUser } from '@/lib/supabase/server'
import { AppVersion } from '@/lib/types'
import { formatDatabaseMessages } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

interface PageParams {
    params: Promise<{ id: string }>
}

// Add a loading component
function ChatLoading() {
    return <div className="h-screen w-full flex items-center justify-center">
        <LoadingAnimation message="Loading chat..." />
    </div>
}

export default async function ChatPage({ params }: PageParams) {
    const { id } = await params
    const user = await getUser()

    if (!user) {
        notFound()
    }

    const supabase = await createClient()

    // Parallel fetch of chat, messages, versions, and associated files
    const [chatResponse, messagesResponse, versionResponse, filesResponse] =
        await Promise.all([
            supabase.from('chats').select('*').eq('id', id).single(),
            supabase
                .from('messages')
                .select('*')
                .eq('chat_id', id)
                .order('created_at', { ascending: true }),
            supabase
                .rpc('get_chat_current_app_version', { p_chat_id: id })
                .single() as unknown as Promise<{
                data: AppVersion[]
                error: any
            }>,
            supabase
                .from('chat_files')
                .select(
                    `
                files (
                    id,
                    file_name,
                    file_type,
                    analysis,
                    created_at
                )
            `
                )
                .eq('chat_id', id),
        ])

    if (chatResponse.error || !chatResponse.data) {
        console.error('Error fetching chat:', chatResponse.error)
        notFound()
    }

    if (messagesResponse.error) {
        console.error('Error fetching messages:', messagesResponse.error)
        notFound()
    }

    const files =
        filesResponse.data
            ?.map((row) => row.files)
            .filter((file): file is NonNullable<typeof file> => file !== null)
            .map((file) => ({
                ...file,
                analysis: file.analysis as string | null,
            })) ?? []

    const messages = formatDatabaseMessages(messagesResponse.data ?? [])

    // Add a key prop to force remount of ChatContainer
    return (
        <Suspense fallback={<ChatLoading />}>
            <ChatContainer
                key={id}
                initialChat={chatResponse.data}
                initialMessages={messages}
                initialVersion={versionResponse.data}
                initialFiles={files}
                initialAppId={chatResponse.data.app_id}
                isInChatPage={true}
            />
        </Suspense>
    )
}

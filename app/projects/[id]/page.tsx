import ChatContainer from '@/components/ChatContainer'
import LoadingAnimation from '@/components/LoadingAnimation'
import { createClient, getUser } from '@/lib/supabase/server'
import { AppVersion } from '@/lib/types'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

interface PageParams {
    params: Promise<{ id: string }>
}

function ChatLoading() {
    return (
        <div className="h-screen w-full flex items-center justify-center">
            <LoadingAnimation message="Loading chat..." />
        </div>
    )
}

export default async function ChatPage({ params }: PageParams) {
    const { id } = await params
    const user = await getUser()

    if (!user) {
        notFound()
    }

    const supabase = await createClient()

    // Parallel fetch of chat and associated data
    const [chatResponse, versionResponse, filesResponse] =
        await Promise.all([
            supabase
                .from('chats')
                .select('*, messages')
                .eq('id', id)
                .single(),
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

    const files =
        filesResponse.data
            ?.map((row) => row.files)
            .filter((file): file is NonNullable<typeof file> => file !== null)
            .map((file) => ({
                ...file,
                analysis: file.analysis as string | null,
            })) ?? []

    // Messages are now directly in the chat object
    const messages = chatResponse.data.messages || []

    console.log('🔄 Messages:', messages)

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

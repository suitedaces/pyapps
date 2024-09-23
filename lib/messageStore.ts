// messageStore.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

interface MessageState {
    messageStoredChatId: string | null
}

class MessageStore {
    private state: MessageState = {
        messageStoredChatId: null
    }

    setMessageStored(chatId: string) {
        this.state.messageStoredChatId = chatId
        this.fetchTitle(chatId)
    }

    async fetchTitle(chatId: string) {
        try {
            const supabase = createRouteHandlerClient({ cookies })
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                throw new Error('Not authenticated')
            }

            const { data, error } = await supabase.rpc('get_chat_messages', {
                p_chat_id: chatId,
                p_limit: 2,
                p_offset: 0,
            })

            if (error) {
                throw new Error('Failed to fetch messages')
            }

            console.log('Fetched data to generate title:', data)
            // Here you would typically update some state or perform an action with the title
        } catch (error) {
            console.error('Error fetching title:', error)
        }
    }
}

export const messageStore = new MessageStore()

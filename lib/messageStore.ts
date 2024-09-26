import { Anthropic } from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { CHAT_TITLE_PROMPT } from './prompts'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultHeaders: {
        'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    },
})

interface MessageState {
    messageStoredChatId: string | null
    processedChatIds: Set<string>
}

interface ChatMessage {
    id: string
    user_id: string
    user_message: string
    assistant_message: string
    tool_calls: any
    tool_results: any
    token_count: number
    created_at: string
}

class MessageStore {
    private state: MessageState = {
        messageStoredChatId: null,
        processedChatIds: new Set(),
    }

    setMessageStored(chatId: string) {
        this.state.messageStoredChatId = chatId
        if (!this.state.processedChatIds.has(chatId)) {
            this.fetchTitle(chatId)
            this.state.processedChatIds.add(chatId)
        }
    }

    async fetchTitle(chatId: string) {
        try {
            const supabase = createRouteHandlerClient({ cookies })
            const {
                data: { session },
            } = await supabase.auth.getSession()

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

            const messages = data as ChatMessage[]
            const userMessage = messages[0]?.user_message || ''
            const assistantMessage = messages[0]?.assistant_message || ''

            const titlePrompt = `${CHAT_TITLE_PROMPT}
            User message: "${userMessage}"
            Assistant message: "${assistantMessage}"
            Generate a concise and relevant title for this chat conversation:`

            const response = await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 50,
                temperature: 0.7,
                messages: [{ role: 'user', content: titlePrompt }],
            })

            let generatedTitle = ''
            if (response.content[0].type === 'text') {
                generatedTitle = response.content[0].text.trim()
            } else {
                throw new Error('Unexpected response format from Anthropic API')
            }

            console.log('Generated title:', generatedTitle)

            const { error: updateError } = await supabase
                .from('chats')
                .update({ name: generatedTitle })
                .eq('id', chatId)

            if (updateError) {
                throw new Error('Failed to update chat title in the database')
            }

            console.log('Chat title successfully updated in the database')

            return generatedTitle
        } catch (error) {
            console.error('Error fetching title:', error)
            throw error
        }
    }
}

export const messageStore = new MessageStore()

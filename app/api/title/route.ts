import { createClient, getUser } from '@/lib/supabase/server'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: Request) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        console.log('❌ Unauthorized user')
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { chatId } = await req.json()
        console.log('🎯 Starting title generation for chat:', chatId)

        // Fetch messages for the chat
        const { data: chatMessages, error: messagesError } = await supabase
            .from('messages')
            .select('user_message, assistant_message')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (messagesError) {
            console.error('❌ Error fetching messages:', messagesError)
            throw new Error('Failed to fetch messages')
        }

        if (!chatMessages) {
            console.log('⚠️ No messages found for chat:', chatId)
            throw new Error('No messages found')
        }

        console.log('📝 Found messages:', {
            userMessage: chatMessages.user_message?.slice(0, 50) + '...',
            assistantMessage: chatMessages.assistant_message?.slice(0, 50) + '...'
        })

        // Generate title
        console.log('🤖 Calling AI for title generation...')
        const response = await generateText({
            model: anthropic('claude-3-haiku-20240307'),
            messages: [
                {
                    role: 'user',
                    content: `Generate a concise, descriptive title (max 4 words) for this conversation. Focus on the main topic or question. Don't use quotes or punctuation.\nUser: ${chatMessages.user_message}\nAssistant: ${chatMessages.assistant_message}`
                }
            ],
            maxTokens: 50,
            temperature: 0.7,
        })

        const title = response.text.trim()
        console.log('✨ Generated title:', title)

        // Update chat title in database
        console.log('💾 Updating chat title in database...')
        const { error: updateError } = await supabase
            .from('chats')
            .update({ name: title })
            .eq('id', chatId)

        if (updateError) {
            console.error('❌ Error updating chat title:', updateError)
            throw new Error('Failed to update chat title')
        }

        console.log('✅ Successfully updated chat title in database')
        return new Response(title, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
    } catch (error) {
        console.error('❌ Error in title generation:', error)
        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        )
    }
}

export const runtime = 'nodejs'

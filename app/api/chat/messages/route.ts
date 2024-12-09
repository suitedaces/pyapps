import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { getUser } from '@/lib/supabase/server'

interface TokenCount {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

export async function POST(req: Request) {
    const user = await getUser()
    const supabase = await createClient()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { 
            chatId,
            userMessage, 
            assistantMessage, 
            toolCalls, 
            toolResults,
            tokenCount
        } = await req.json()

        let currentChatId = chatId

        // Only create a new chat if we don't have one AND we have a message to store
        if (!currentChatId && userMessage && assistantMessage) {
            const { data: chat } = await supabase
                .from('chats')
                .insert({
                    user_id: user.id,
                    name: userMessage.slice(0, 50) + '...',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single()

            currentChatId = chat?.id
        }

        // Only store message if we have both user and assistant messages
        if (currentChatId && userMessage && assistantMessage) {
            const { data: message, error: messageError } = await supabase
                .from('messages')
                .insert({
                    chat_id: currentChatId,
                    user_id: user.id,
                    user_message: userMessage,
                    assistant_message: assistantMessage,
                    tool_calls: toolCalls,
                    tool_results: toolResults,
                    token_count: tokenCount,
                    created_at: new Date().toISOString(),
                })
            
            if (messageError) {
                console.error('Error storing message:', messageError)
                return new Response('Error storing message', { status: 500 })
            }
        }

        return Response.json({ 
            chatId: currentChatId 
        })
    } catch (error) {
        console.error('Error storing message chain:', error)
        return new Response('Error storing message', { status: 500 })
    }
} 
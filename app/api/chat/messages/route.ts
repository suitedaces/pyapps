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

        // Create new chat if needed
        if (!currentChatId) {
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

        // Store message chain with token count
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

        // Update user's token usage
        // await supabase.rpc('update_user_token_usage', {
        //     p_user_id: user.id,
        //     p_tokens: tokenCount.totalTokens
        // })

        return Response.json({ 
            chatId: currentChatId 
        })
    } catch (error) {
        console.error('Error storing message chain:', error)
        return new Response('Error storing message', { status: 500 })
    }
} 
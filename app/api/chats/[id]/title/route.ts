import { createClient, getUser } from '@/lib/supabase/server'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(
    request: Request,
    context: { params: { id: string } }
) {
    const { id } = await context.params
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        // Get chat messages directly from chats table
        const { data: chat, error } = await supabase
            .from('chats')
            .select('messages')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error) throw error
        if (!chat?.messages?.length) {
            return new Response(
                JSON.stringify({ title: 'New Chat' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // Get the first user message
        const firstUserMessage = chat.messages.find(m => m.role === 'user')
        if (!firstUserMessage) {
            return new Response(
                JSON.stringify({ title: 'New Chat' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // Generate title using AI
        const { text: title } = await generateText({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that generates concise, descriptive titles for chat conversations. Generate a title that is at most 6 words long based on the first message in the chat.'
                },
                {
                    role: 'user',
                    content: firstUserMessage.content
                }
            ],
            maxTokens: 50,
            temperature: 0.7
        })

        // Update chat title
        await supabase
            .from('chats')
            .update({ name: title || 'New Chat' })
            .eq('id', id)
            .eq('user_id', user.id)

        return new Response(
            JSON.stringify({ title: title || 'New Chat' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Error generating title:', error)
        return new Response(
            JSON.stringify({ error: 'Failed to generate title' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

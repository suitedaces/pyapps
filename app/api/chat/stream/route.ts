import { streamText } from 'ai'
import { createClient } from '@/supabase/server'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { streamlitTool } from '@/lib/tools/streamlit'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return new Response('Unauthorized', { status: 401 })

    try {
        const { messages, chatId, fileId, fileName, fileContent } = await req.json()

        // Handle chat creation/retrieval
        let currentChatId = chatId
        if (!currentChatId) {
            const { data: newChat } = await supabase
                .from('chats')
                .insert({
                    user_id: session.user.id,
                    name: messages[0]?.content?.slice(0, 50) || 'New Chat',
                    created_at: new Date().toISOString(),
                })
                .select()
                .single()

            currentChatId = newChat.id
        }

        // Get file context if needed
        let fileContext = undefined
        if (fileId) {
            const { data: fileData } = await supabase
                .from('files')
                .select('*')
                .eq('id', fileId)
                .eq('user_id', session.user.id)
                .single()

            fileContext = {
                fileName: fileData.file_name,
                fileType: fileData.file_type,
                analysis: fileData.analysis
            }
        }

        const result = await streamText({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [
                {
                    role: 'system',
                    content: fileContext 
                        ? `${CHAT_SYSTEM_PROMPT}\n\nYou are working with a ${fileContext.fileType.toUpperCase()} file named "${fileContext.fileName}".`
                        : CHAT_SYSTEM_PROMPT
                },
                ...messages
            ],
            tools: { streamlitTool },
            onChunk: async (event) => {
                const { chunk } = event
                if (chunk.type === 'tool-call') {
                    const toolResult = await streamlitTool.execute({
                        query: chunk.args.query,
                        fileContext: chunk.args.fileContext,
                        chatId: currentChatId
                    })
                }
            }
        })

        // Convert to a streaming response using the built-in method
        return result.toTextStreamResponse({
            headers: {
                'x-chat-id': currentChatId
            }
        })

    } catch (error) {
        console.error('Error in chat stream:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500 }
        )
    }
}

export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { streamlitTool } from '@/lib/tools/streamlit'
import { anthropic } from '@ai-sdk/anthropic'
import { getUser } from '@/lib/supabase/server'

export async function POST(req: Request) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) return new Response('Unauthorized', { status: 401 })

    try {
        const { messages, chatId, fileId, fileName, fileContent } = await req.json()

        // Handle chat creation/retrieval
        let currentChatId = chatId
        if (!currentChatId) {
            const { data: newChat } = await supabase
                .from('chats')
                .insert({
                    user_id: user.id,
                    name: messages[0]?.content?.slice(0, 50) || 'New Chat',
                    created_at: new Date().toISOString(),
                })
                .select()
                .single()

            currentChatId = newChat?.id || ''
        }

        let fileContext = undefined
        if (fileId) {
            const { data: fileData } = await supabase
                .from('files')
                .select('*')
                .eq('id', fileId)
                .eq('user_id', user.id)
                .single()

            fileContext = {
                fileName: fileData?.file_name,
                fileType: fileData?.file_type,
                analysis: fileData?.analysis
            }
        }

        const SYSTEM_PROMPT = fileContext
            ? `${CHAT_SYSTEM_PROMPT}\n\nYou are working with a ${fileContext?.fileType?.toUpperCase()} file named "${fileContext?.fileName}. Here's some information about the file: ${fileContext?.analysis}`
            : CHAT_SYSTEM_PROMPT

        console.log('🔍 Streaming with fileContext:', fileContext)
        const result = await streamText({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT
                },
                ...messages
            ],
            tools: { streamlitTool },
            experimental_toolCallStreaming: true
        })

        // Important: Use toDataStreamResponse for proper streaming
        return result.toDataStreamResponse({
            headers: {
                'x-chat-id': currentChatId,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
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
import { Json } from '@/lib/database.types'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { createClient, getUser } from '@/lib/supabase/server'
import { streamlitTool } from '@/lib/tools/streamlit'
import { suggestionsTool } from '@/lib/tools/suggestions'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

export async function POST(req: Request) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) return new Response('Unauthorized', { status: 401 })

    try {
        const { messages, chatId, fileId, fileName, fileContent } = await req.json()

        // Use existing chat ID if provided
        let newChatId = chatId
        
        // Only create new chat if no chat ID exists
        if (!chatId) {
            const { data: newChat, error } = await supabase
                .from('chats')
                .insert([
                    {
                        user_id: user.id,
                        name: messages[messages.length - 1]?.content?.slice(0, 100) || 'New Chat',
                    },
                ])
                .select()
                .single()

            if (error) throw error
            newChatId = newChat.id
        }

        // Associate file with chat if provided
        if (fileId && newChatId) {
            const { error: chatFileError } = await supabase
                .from('chat_files')
                .insert([
                    {
                        chat_id: newChatId,
                        file_id: fileId,
                    },
                ])

            if (chatFileError) {
                console.error('Error associating file with chat:', chatFileError)
            }
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
                analysis: fileData?.analysis,
            }
        }

        const SYSTEM_PROMPT = fileContext
            ? `${CHAT_SYSTEM_PROMPT}\n\nYou are working with a ${fileContext?.fileType?.toUpperCase()} file named "${fileContext?.fileName}" in the directory "/app/s3/data/${fileContext?.fileName}". Here's some information about the file: ${fileContext?.analysis}`
            : CHAT_SYSTEM_PROMPT

        console.log('🔍 Streaming with fileContext:', fileContext)
        const result = await streamText({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT,
                },
                ...messages,
            ],
            tools: { streamlitTool, suggestionsTool },
            experimental_toolCallStreaming: true,
            onFinish: async (event) => {
                const { text, toolCalls, toolResults, usage } = event
                if (!text) return

                try {
                    const userMessage = messages[messages.length - 1].content

                    // Create new chat if needed
                    if (!newChatId) {
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

                        newChatId = chat?.id
                    }
                    // Store message with all relevant data
                    await supabase.from('messages').insert({
                        chat_id: newChatId as string,
                        user_id: user.id,
                        user_message: userMessage,
                        assistant_message: text,
                        tool_calls: toolCalls as Json,
                        tool_results: toolResults as Json,
                        token_count: usage.totalTokens,
                        created_at: new Date().toISOString(),
                    })

                    return newChatId
                } catch (error) {
                    console.error('Error storing message:', error)
                    throw error
                }
            },
        })

        // Important: Use toDataStreamResponse for proper streaming
        return result.toDataStreamResponse({
            headers: {
                'x-chat-id': newChatId,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
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
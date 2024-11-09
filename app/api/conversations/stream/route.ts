import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { GruntyAgent } from '@/lib/agent'
import { getModelClient } from '@/lib/modelProviders'
import { tools } from '@/lib/tools'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { LLMModel, LLMModelConfig } from '@/lib/types'
import { Message, convertToCoreMessages } from 'ai'
import { generateUUID } from '@/lib/utils'

// Handle streaming responses for new conversations
export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { messages, model, config, options } = await req.json() as {
            messages: Message[]
            model: LLMModel
            config: LLMModelConfig
            options?: {
                body?: {
                    fileContent?: string
                    fileName?: string
                }
            }
        }

        let csvAnalysis = null
        if (options?.body?.fileContent) {
            // Create detailed analysis from file content
            const rows = options.body.fileContent.split('\n')
            const columns = rows[0].split(',')
            const dataRows = rows.slice(1)

            // Create more comprehensive analysis
            csvAnalysis = {
                fileId: generateUUID(), // Generate a unique ID for the file
                fileName: options.body.fileName,
                columns: columns,
                rowCount: dataRows.length,
                preview: rows.slice(1, 6),
                summary: {
                    totalRows: dataRows.length,
                    columnCount: columns.length,
                    columnNames: columns,
                    sampleData: dataRows.slice(0, 5).map(row => row.split(',')),
                    columnTypes: columns.map(col => {
                        // Try to determine column type from data
                        const sampleValues = dataRows.slice(0, 5).map(row => row.split(',')[columns.indexOf(col)])
                        return {
                            name: col,
                            type: sampleValues.every(val => !isNaN(Number(val))) ? 'numeric' : 'categorical'
                        }
                    })
                }
            }

            console.log('📊 Created CSV Analysis:', {
                fileName: csvAnalysis.fileName,
                columnCount: csvAnalysis.columns.length,
                rowCount: csvAnalysis.rowCount,
                preview: csvAnalysis.preview.length
            })
        }

        if (!messages?.length) {
            return new Response('No messages provided', { status: 400 })
        }

        // Create new chat and get stream response
        const chatId = generateUUID()
        await supabase
            .from('chats')
            .insert([{
                id: chatId,
                user_id: session.user.id,
                name: messages[0].content.slice(0, 50) + '...',
            }])

        const modelClient = getModelClient(model, {
            apiKey: process.env.ANTHROPIC_API_KEY,
            temperature: config?.temperature || 0.7,
            maxTokens: config?.maxTokens || 4096
        })

        const agent = new GruntyAgent(
            modelClient,
            'AI Assistant',
            CHAT_SYSTEM_PROMPT,
            {
                ...config,
                model: model.id
            }
        )

        console.log('🚀 Initializing stream with:', {
            chatId,
            messageCount: messages.length,
            hasAnalysis: !!csvAnalysis,
            analysisPreview: csvAnalysis ? {
                columns: csvAnalysis.columns.length,
                rows: csvAnalysis.rowCount,
                fileName: csvAnalysis.fileName
            } : null
        })

        const agentResponse = await agent.streamResponse(
            chatId,
            session.user.id,
            convertToCoreMessages(messages),
            tools,
            csvAnalysis // Now passing the detailed analysis
        )

        // Get the readable stream from the agent's response
        if (!agentResponse.body) {
            throw new Error('No stream body returned from agent')
        }

        return new Response(agentResponse.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'x-chat-id': chatId
            }
        })

    } catch (error) {
        console.error('💥 Error in stream processing:', error)
        throw error
    }
}

export const runtime = 'nodejs'

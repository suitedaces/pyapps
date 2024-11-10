import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { GruntyAgent } from '@/lib/agent'
import { getModelClient } from '@/lib/modelProviders'
import { tools } from '@/lib/tools'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { FileContext, LLMModel, LLMModelConfig } from '@/lib/types'
import { Message, convertToCoreMessages } from 'ai'
import { generateUUID } from '@/lib/utils'
import { z } from 'zod'

// Validation schema for request body
const RequestSchema = z.object({
    messages: z.array(z.object({
        content: z.string(),
        role: z.enum(['user', 'assistant', 'system']),
        createdAt: z.date().optional(),
    })),
    model: z.object({
        id: z.string(),
        provider: z.string(),
        providerId: z.string(),
        name: z.string(),
    }),
    config: z.object({
        model: z.string(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
    }),
    fileId: z.string().optional(),
    fileName: z.string().optional(),
    fileContent: z.string().optional(),
})

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    const chatId = generateUUID()
    if (!session) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const body = await req.json()

        console.log('🔍 Raw request body:', {
            hasBody: !!body,
            bodyKeys: Object.keys(body),
            requestBody: body.body,
        })

        const { messages, model, config, fileId, fileName, fileContent } = await RequestSchema.parseAsync(body)

        console.log('🔍 Parsed request body:', {
            hasFileId: !!fileId,
            hasFileName: !!fileName,
            hasFileContent: !!fileContent,
        })

        let fileContext: FileContext | undefined = undefined
        if (fileId) {
            console.log('🔍 Fetching file data:', { fileId })

            const { data: fileData, error: fileError } = await supabase
                .from('files')
                .select('*')
                .eq('id', fileId)
                .eq('user_id', session.user.id)
                .single()

            if (fileError) {
                console.error('❌ Error fetching file:', fileError)
                return new Response('File not found', { status: 404 })
            }

            console.log('📄 File data fetched:', fileData);

            fileContext = {
                fileName: fileData.file_name,
                fileType: fileData.file_type as 'csv' | 'json',
                content: fileContent,
                analysis: fileData.analysis,
            }

            console.log('📄 File context created:', {
                fileId: fileData.id,
                fileName: fileData.file_name,
                hasAnalysis: !!fileData.analysis
            })

            await supabase
                .from('files')
                .update({
                    last_accessed: new Date().toISOString(),
                    chat_id: chatId
                })
                .eq('id', fileData.id)
        }

        const { error: chatError } = await supabase
            .from('chats')
            .insert([{
                id: chatId,
                user_id: session.user.id,
                name: messages[0].content.slice(0, 50) + '...',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])

        if (chatError) {
            console.error('❌ Error creating chat:', chatError)
            return new Response('Failed to create chat', { status: 500 })
        }

        if (fileContext?.id) {
            console.log('🔄 Updating file with chat ID:', {
                fileId: fileContext.id,
                chatId
            })

            const { error: fileUpdateError } = await supabase
                .from('files')
                .update({ chat_id: chatId })
                .eq('id', fileContext.id)

            if (fileUpdateError) {
                console.error('❌ Error updating file with chat_id:', fileUpdateError)
            }
        }

        console.log('🎯 Initializing model client:', {
            modelId: model.id,
            provider: model.provider
        })

        const modelClient = getModelClient({
            id: model.id,
            provider: model.provider,
            name: model.name,
            providerId: model.providerId
        }, {
            apiKey: process.env.ANTHROPIC_API_KEY || '',
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
            hasFile: !!fileContext,
            fileInfo: fileContext ? {
                id: fileContext.id,
                name: fileContext.fileName,
                type: fileContext.fileType,
                hasAnalysis: !!fileContext.analysis
            } : null
        })

        console.log("🚀 ~ fileContext", fileContext);

        const agentResponse = await agent.streamResponse(
            chatId,
            session.user.id,
            convertToCoreMessages(messages),
            tools,
            fileContext
        )

        if (!agentResponse.body) {
            throw new Error('No stream body returned from agent')
        }

        return new Response(agentResponse.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'x-chat-id': chatId,
                'x-file-id': fileContext?.id || '',
            }
        })

    } catch (error) {
        console.error('❌ Error in stream processing:', error)
        return new Response(
            JSON.stringify({
                error: error instanceof z.ZodError
                    ? 'Invalid request format'
                    : 'Internal server error'
            }),
            {
                status: error instanceof z.ZodError ? 400 : 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
}

export const runtime = 'nodejs'

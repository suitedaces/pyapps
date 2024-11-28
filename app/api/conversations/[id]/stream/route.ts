import { GruntyAgent } from '@/lib/agent'
import { getModelClient } from '@/lib/modelProviders'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { tools } from '@/lib/tools'
import { FileContext, Tool } from '@/lib/types'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { convertToCoreMessages } from 'ai'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { z } from 'zod'

// Validation schema for request body
const RequestSchema = z.object({
    messages: z.array(
        z.object({
            content: z.string(),
            role: z.enum(['user', 'assistant', 'system']),
            createdAt: z
                .union([z.date(), z.string().transform((str) => new Date(str))])
                .optional(),
        })
    ),
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

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        return new Response('Unauthorized', { status: 401 })
    }

    if (!params.id) {
        return new Response('Invalid chat ID', { status: 400 })
    }

    try {
        const body = await req.json()
        const { messages, model, config, fileId, fileName, fileContent } =
            await RequestSchema.parseAsync(body)

        console.log('🔍 Fetching chat data:', { chatId: params.id })

        // Fetch chat and verify ownership
        const { data: chatData, error: chatError } = await supabase
            .from('chats')
            .select('*')
            .eq('id', params.id)
            .eq('user_id', session.user.id)
            .single()

        if (chatError || !chatData) {
            console.error('❌ Chat not found:', chatError)
            return new Response('Chat not found', { status: 404 })
        }

        // Initialize fileContext as undefined
        let fileContext: FileContext | undefined = undefined

        // Check for file in request or existing chat
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

            fileContext = {
                id: fileData.id,
                fileName: fileData.file_name,
                fileType: fileData.file_type as 'csv' | 'json' | 'txt',
                content: fileContent,
                analysis: fileData.analysis,
            }

            console.log('📄 File context created:', {
                fileId: fileData.id,
                fileName: fileData.file_name,
                hasAnalysis: !!fileData.analysis,
            })

            // Update file access timestamp
            await supabase
                .from('files')
                .update({ last_accessed: new Date().toISOString() })
                .eq('id', fileData.id)
        }

        console.log('🎯 Initializing model client:', {
            modelId: model.id,
            provider: model.provider,
        })

        const modelClient = getModelClient(
            {
                id: model.id,
                provider: model.provider,
                name: model.name,
                providerId: model.providerId,
            },
            {
                apiKey: process.env.ANTHROPIC_API_KEY || '',
                temperature: config?.temperature || 0.7,
                maxTokens: config?.maxTokens || 4096,
            }
        )

        const agent = new GruntyAgent(
            modelClient,
            'AI Assistant',
            CHAT_SYSTEM_PROMPT,
            {
                ...config,
                model: model.id,
            }
        )

        console.log('🚀 Continuing chat stream with:', {
            chatId: params.id,
            messageCount: messages.length,
            hasFile: !!fileContext,
            fileInfo: fileContext
                ? {
                      id: fileContext.id,
                      name: fileContext.fileName,
                      type: fileContext.fileType,
                      hasAnalysis: !!fileContext.analysis,
                  }
                : null,
        })

        return agent.streamResponse(
            params.id,
            session.user.id,
            convertToCoreMessages(messages),
            tools as Tool[],
            fileContext
        )
    } catch (error) {
        console.error('❌ Error in stream processing:', error)
        return new Response(
            JSON.stringify({
                error:
                    error instanceof z.ZodError
                        ? 'Invalid request format'
                        : 'Internal server error',
            }),
            {
                status: error instanceof z.ZodError ? 400 : 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}

export const runtime = 'nodejs'

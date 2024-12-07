import { createClient } from '@/lib/supabase/server'
import { StreamlitToolArgs, StreamlitToolResult } from '@/lib/types'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

export const streamlitTool = {
    description: 'Generate a Streamlit app with data visualization',
    parameters: z.object({
        query: z.string(),
        fileContext: z.object({
            fileName: z.string(),
            fileType: z.enum(['csv', 'json']),
            analysis: z.any().optional(),
        }).optional(),
        chatId: z.string()
    }),
    execute: async ({ query, fileContext, chatId }: StreamlitToolArgs): Promise<StreamlitToolResult> => {
        const supabase = await createClient()

        try {
            // Generate Streamlit code using Claude
            const { text: code } = await generateText({
                model: anthropic('claude-3-5-sonnet-20241022'),
                messages: [
                    {
                        role: 'system',
                        content: `Generate a Streamlit app based on the query.
                        ${fileContext ? `Use the file at path "/app/${fileContext.fileName}"` : ''}
                        Include all necessary imports. Only respond with code.`
                    },
                    { role: 'user', content: query }
                ]
            })

            // Create or update app version in database
            const { data: chat } = await supabase
                .from('chats')
                .select('app_id')
                .eq('id', chatId)
                .single()

            let appId = chat?.app_id

            if (!appId) {
                // Create new app
                const { data: app, error: appError } = await supabase
                    .from('apps')
                    .insert({
                        name: query.slice(0, 50) + '...',
                        description: 'Streamlit app created from chat',
                        is_public: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .select()
                    .single()

                if (appError) throw appError
                appId = app.id

                // Link app to chat
                await supabase
                    .from('chats')
                    .update({ app_id: appId })
                    .eq('id', chatId)
            }

            // Create new version
            const { data: version, error: versionError } = await supabase
                .from('versions')
                .insert({
                    app_id: appId,
                    code: code,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single()

            if (versionError) throw versionError

            return {
                code,
                appId: appId!,
                success: true
            }

        } catch (error) {
            console.error('Error in streamlit tool:', error)
            throw error
        }
    }
} 
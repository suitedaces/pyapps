'use server'

import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createStreamableValue } from 'ai/rsc'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Schema for the Streamlit tool
const streamlitToolSchema = z.object({
    code: z.string().describe('The system prompt or initial code'),
    app_name: z.string().describe('The name of the Streamlit app'),
    libraries: z.array(z.string()).describe('Required Python libraries'),
    file_context: z.object({
        file_name: z.string().optional(),
        file_type: z.string().optional(),
    }).optional()
})

export async function streamlitAgent(
    input: string,
    chatId: string,
    userId: string,
    fileContext?: {
        fileName?: string
        fileType?: string
        content?: string
    }
) {
    const mainStream = createStreamableValue<string>('')
    
    try {
        const supabase = createRouteHandlerClient({ cookies })

        // Define the Streamlit app generation tool first
        const createStreamlitAppTool = {
            name: 'create_streamlit_app',
            description: 'Generate a Streamlit app based on requirements',
            parameters: streamlitToolSchema,
            execute: async ({ code, app_name, libraries, file_context }: z.infer<typeof streamlitToolSchema>) => {
                const appStream = createStreamableValue<string>('')
                
                try {
                    const { textStream } = await streamText({
                        model: anthropic('claude-3-sonnet-20241022'),
                        messages: [{
                            role: 'system',
                            content: `You are a Python code generation assistant specializing in Streamlit apps.
                            Generate a complete, runnable Streamlit app based on the given requirements.
                            ${file_context ? `You are working with a ${file_context.file_type} file at path "/app/s3/data/${file_context.file_name}".` : ''}
                            Only respond with the code, no explanations!`
                        }, {
                            role: 'user',
                            content: code
                        }]
                    })

                    let collectedCode = ''
                    for await (const chunk of textStream) {
                        collectedCode += chunk
                        appStream.update(chunk)
                    }

                    // Create app version in database
                    const { data: app } = await supabase
                        .from('apps')
                        .insert({
                            name: app_name,
                            user_id: userId,
                            description: code,
                            is_public: false
                        })
                        .select()
                        .single()

                    if (app) {
                        await supabase
                            .from('versions')
                            .insert({
                                app_id: app.id,
                                code: collectedCode,
                                created_at: new Date().toISOString()
                            })

                        // Link chat to app
                        await supabase
                            .from('chats')
                            .update({ app_id: app.id })
                            .eq('id', chatId)
                    }

                    appStream.done()
                    return { code: collectedCode }

                } catch (error) {
                    console.error('Error generating Streamlit app:', error)
                    throw error
                }
            }
        }
        
        // Add file context to system prompt if present
        const systemPrompt = `You are an AI assistant helping users create Streamlit apps. 
            When the user provides requirements, use the create_streamlit_app tool to generate code.
            ${fileContext ? `
            The user is working with a ${fileContext.fileType} file named "${fileContext.fileName}".
            File content: ${fileContext.content}
            ` : ''}`

        // Now use the tool in the main conversation
        const { textStream } = await streamText({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [{
                role: 'system',
                content: systemPrompt
            }, {
                role: 'user',
                content: input
            }],
            tools: {
                create_streamlit_app: createStreamlitAppTool
            }
        })

        for await (const chunk of textStream) {
            mainStream.update(chunk)
        }

        mainStream.done()
        return mainStream.value

    } catch (error) {
        console.error('Error in main agent:', error)
        throw error
    }
} 
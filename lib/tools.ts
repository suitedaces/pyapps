import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { toolRegistry } from './tools/registry'
import { StreamlitTool } from './tools/streamlit'
import { StreamingTool } from './tools/types'

// Initialize and register all tools
const streamlitTool = new StreamlitTool()
toolRegistry.register(streamlitTool)

// Export tools for use in the application
export const tools = toolRegistry.getAllTools()

// Helper to get tool by name
export function getToolByName(name: string): StreamingTool | undefined {
    return toolRegistry.get(name)
}

// Enhanced tool execution with streaming and database integration
export async function executeToolCall(
    toolInvocation: any,
    fileContext?: any,
    signal?: AbortSignal
): Promise<any> {
    const tool = getToolByName(toolInvocation.toolName)
    if (!tool) {
        throw new Error(`Tool not found: ${toolInvocation.toolName}`)
    }

    const args = { ...toolInvocation.args, fileContext }
    const toolCallId = toolInvocation.toolCallId || crypto.randomUUID()

    try {
        // Validate the tool call first
        const validation = await toolRegistry.validateToolCall(
            toolInvocation.toolName,
            args
        )

        if (!validation.valid) {
            throw new Error(validation.error)
        }

        let collectedContent = ''
        let isInterrupted = false

        // Use registry's streamToolExecution for better stream management
        for await (const part of toolRegistry.streamToolExecution(
            toolCallId,
            toolInvocation.toolName,
            args
        )) {
            switch (part.type) {
                case 'tool-call-streaming-start':
                    console.log(`🚀 Starting tool execution: ${toolCallId}`)
                    break

                case 'tool-call-delta':
                    collectedContent += part.argsTextDelta
                    break

                case 'tool-result':
                    console.log(`✅ Tool execution completed: ${toolCallId}`)
                    break
            }

            // Check for manual interruption
            if (signal?.aborted) {
                toolRegistry.abortToolExecution(toolCallId)
                break
            }
        }

        // If execution was successful and we have content
        if (!isInterrupted && collectedContent) {
            // Handle tool-specific results
            if (tool.toolName === 'create_streamlit_app') {
                await handleStreamlitResult(
                    collectedContent,
                    toolInvocation,
                    fileContext
                )
            }

            return { generatedCode: collectedContent }
        } else {
            throw new Error(
                isInterrupted
                    ? 'Tool execution was interrupted'
                    : 'No content generated'
            )
        }
    } catch (error) {
        console.error('Tool execution failed:', {
            toolName: tool.toolName,
            toolCallId,
            error: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
    }
}

// Helper function to handle Streamlit-specific results
async function handleStreamlitResult(
    code: string,
    toolInvocation: any,
    fileContext?: any
) {
    const supabase = createRouteHandlerClient({ cookies })

    try {
        // Get chat and app information
        const { data: chat } = await supabase
            .from('chats')
            .select('app_id')
            .eq('id', toolInvocation.chatId)
            .single()

        const appId = chat?.app_id
        const baseAppName =
            fileContext?.fileName?.replace('.csv', '') || 'streamlit-app'

        if (!appId) {
            // Create new app if doesn't exist
            const { data: newApp, error: appError } = await supabase
                .from('apps')
                .insert({
                    name: baseAppName,
                    description: toolInvocation.args.query,
                    is_public: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single()

            if (appError) throw appError

            // Link chat to app
            await supabase
                .from('chats')
                .update({ app_id: newApp.id })
                .eq('id', toolInvocation.chatId)

            // Create initial version
            await createVersion(newApp.id, code)
        } else {
            // Create new version for existing app
            await createVersion(appId, code)
        }
    } catch (error) {
        console.error('Failed to handle Streamlit result:', error)
        throw error
    }
}

// Helper function to create version (imported from supabase.ts)
async function createVersion(appId: string, code: string) {
    const supabase = createRouteHandlerClient({ cookies })

    const { data, error } = await supabase
        .from('versions')
        .insert({
            app_id: appId,
            code,
            created_at: new Date().toISOString(),
        })
        .select()

    if (error) throw error
    return data
}

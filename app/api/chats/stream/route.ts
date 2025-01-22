import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { createClient, getUser } from '@/lib/supabase/server'
import { streamlitTool } from '@/lib/tools/streamlit'
import { anthropic } from '@ai-sdk/anthropic'
import { Message, streamText } from 'ai'

export const maxDuration = 150

interface StreamlitToolCall {
    toolCallId: string
    toolName: string
    args: {
        code: string
        appName: string
        appDescription: string
    }
}

interface FileContext {
    fileName: string
    fileType: string
    analysis: string
}

// Chat Management
async function createNewChat(supabase: any, userId: string, chatName: string) {
    const { data: chat, error } = await supabase
        .from('chats')
        .insert([{ user_id: userId, name: chatName }])
        .select()
        .single()

    if (error) throw error
    return chat
}

async function linkFileToChat(supabase: any, chatId: string, fileId: string) {
    const { error } = await supabase
        .from('chat_files')
        .insert([{ chat_id: chatId, file_id: fileId }])

    if (error) {
        console.error('Error associating file with chat:', error)
        return false
    }
    return true
}

// File Management
async function getFileContext(
    supabase: any,
    chatId: string | undefined,
    userId: string
): Promise<Set<FileContext> | undefined> {
    if (!chatId) return undefined

    // Get all files associated with the chat
    const { data: chatFiles, error } = await supabase
        .from('chat_files')
        .select(`
            files (
                file_name,
                file_type,
                analysis,
                user_id
            )
        `)
        .eq('chat_id', chatId)
        .filter('files.user_id', 'eq', userId)

    if (error || !chatFiles?.length) return undefined

    // Create a Map to store unique files by fileName
    const uniqueFiles = new Map<string, FileContext>()
    
    chatFiles.forEach((row: any) => {
        const file = row.files
        if (file && file.file_name) {
            uniqueFiles.set(file.file_name, {
                fileName: file.file_name,
                fileType: file.file_type,
                analysis: file.analysis || '',
            })
        }
    })

    const files = Array.from(uniqueFiles.values())
    return files.length > 0 ? new Set(files) : undefined
}

// Message Management

// App Version Management
async function getNextVersionNumber(
    supabase: any,
    appId: string
): Promise<number> {
    const { data } = await supabase
        .from('app_versions')
        .select('version_number')
        .eq('app_id', appId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

    return (data?.version_number || 0) + 1
}

async function getCurrentAppVersion(supabase: any, appId: string) {
    const { data: app } = await supabase
        .from('apps')
        .select('current_version_id')
        .eq('id', appId)
        .single()

    if (!app?.current_version_id) return null

    const { data: version } = await supabase
        .from('app_versions')
        .select('code')
        .eq('id', app.current_version_id)
        .single()

    return version
}

async function createNewApp(
    supabase: any,
    userId: string,
    name: string,
    description: string
) {
    const { data: app } = await supabase
        .from('apps')
        .insert({
            user_id: userId,
            name,
            description,
            is_public: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: userId,
        })
        .select()
        .single()

    return app
}

async function createAppVersion(
    supabase: any,
    appId: string,
    versionNumber: number,
    code: string,
    name: string,
    description: string
) {
    const { data: version } = await supabase
        .from('app_versions')
        .insert({
            app_id: appId,
            version_number: versionNumber,
            code,
            created_at: new Date().toISOString(),
            name,
            description,
        })
        .select()
        .single()

    return version
}

async function updateAppCurrentVersion(
    supabase: any,
    appId: string,
    versionId: string
) {
    await supabase
        .from('apps')
        .update({
            current_version_id: versionId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', appId)
}

async function handleStreamlitAppVersioning(
    supabase: any,
    userId: string,
    chatId: string,
    toolCall: StreamlitToolCall
): Promise<string | null> {
    if (!toolCall.args) return null

    const { code, appName, appDescription } = toolCall.args

    // Check for existing app
    const { data: chat } = await supabase
        .from('chats')
        .select('app_id')
        .eq('id', chatId)
        .single()

    let appId = chat?.app_id

    if (!appId) {
        // Create new app flow
        const app = await createNewApp(
            supabase,
            userId,
            appName || 'Untitled App',
            appDescription || ''
        )
        appId = app.id

        const version = await createAppVersion(
            supabase,
            appId,
            1,
            code,
            appName || 'Version 1',
            appDescription || ''
        )

        await Promise.all([
            updateAppCurrentVersion(supabase, appId, version.id),
            linkChatToApp(supabase, chatId, appId),
        ])
    } else {
        // Update existing app flow
        const currentVersion = await getCurrentAppVersion(supabase, appId)

        if (currentVersion?.code !== code) {
            const nextVersion = await getNextVersionNumber(supabase, appId)

            const version = await createAppVersion(
                supabase,
                appId,
                nextVersion,
                code,
                appName || `Version ${nextVersion}`,
                appDescription || ''
            )

            await updateAppCurrentVersion(supabase, appId, version.id)
        }
    }

    return appId
}

async function linkChatToApp(supabase: any, chatId: string, appId: string) {
    await supabase.from('chats').update({ app_id: appId }).eq('id', chatId)
}

function buildSystemPrompt(fileContexts: Set<FileContext> | undefined): string {
    if (!fileContexts?.size) return CHAT_SYSTEM_PROMPT

    // Convert Set to Array and remove duplicates based on fileName
    const uniqueContexts = Array.from(
        new Map(
            Array.from(fileContexts).map(context => [context.fileName, context])
        ).values()
    )

    const fileDescriptions = uniqueContexts
        .map(context => 
            `- A ${context.fileType.toUpperCase()} file named "${context.fileName}" in the directory "/app/s3/data/${context.fileName}". Analysis: ${context.analysis}`
        )
        .join('\n')

    return `${CHAT_SYSTEM_PROMPT}\n\nYou are working with the following files:\n${fileDescriptions}`
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        console.log('❌ Unauthorized user')
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { messages, chatId, fileId, fileIds } = await req.json()
        let newChatId = chatId
        let appId: string | null = null

        // Initialize chat if needed
        if (!chatId) {
            const chat = await createNewChat(
                supabase,
                user.id,
                messages[messages.length - 1]?.content?.slice(0, 100) ||
                    'New Chat'
            )
            newChatId = chat.id
        }

        // Handle file associations
        if (fileId && newChatId) {
            await linkFileToChat(supabase, newChatId, fileId)
        }
        if (fileIds?.length && newChatId) {
            await Promise.all(
                fileIds.map((fId: string) => linkFileToChat(supabase, newChatId, fId))
            )
        }

        // Get file contexts if needed
        const fileContexts = await getFileContext(supabase, newChatId, user.id)
        const systemPrompt = buildSystemPrompt(fileContexts)

        console.log('🔍 Streaming with fileContexts:', fileContexts)
        const result = streamText({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            tools: { streamlitTool },
            maxSteps: 5,
            experimental_toolCallStreaming: true,
            onFinish: async (event) => {
                const { response } = event
                if (!response?.messages?.length) return

                try {
                    // Combine existing and new messages
                    const allMessages = [...messages, ...response.messages]
                    console.log('💾 Processing messages:', JSON.stringify(allMessages, null, 2))

                    // Validate messages
                    const validMessages = allMessages.filter(msg => {
                        if (msg.role !== 'assistant' && msg.role !== 'user') return true;
                        if (Array.isArray(msg.content)) {
                            return msg.content.length > 0;
                        }
                        return typeof msg.content === 'string' && msg.content.trim().length > 0;
                    });

                    // Find all assistant messages with tool calls
                    const streamlitCalls = validMessages
                        .filter(msg => msg.role === 'assistant' && Array.isArray(msg.content))
                        .flatMap(msg => msg.content)
                        .filter((content: any) => 
                            content.type === 'tool-call' && 
                            content.toolName === 'streamlitTool' &&
                            content.args?.code
                        )

                    // Get the latest Streamlit call
                    const latestStreamlitCall = streamlitCalls[streamlitCalls.length - 1]
                    console.log('🔍 Latest Streamlit call:', JSON.stringify(latestStreamlitCall, null, 2))

                    if (latestStreamlitCall) {
                        // Transform to expected format
                        const transformedCall = {
                            toolCallId: latestStreamlitCall.toolCallId,
                            toolName: latestStreamlitCall.toolName,
                            args: latestStreamlitCall.args
                        }
                        console.log('✨ Creating app version with:', JSON.stringify(transformedCall, null, 2))

                        appId = await handleStreamlitAppVersioning(
                            supabase,
                            user.id,
                            newChatId,
                            transformedCall
                        )
                        console.log('✅ Created app with ID:', appId)
                    }

                    // Store all messages
                    await supabase
                        .from('chats')
                        .update({
                            updated_at: new Date().toISOString(),
                            messages: validMessages,
                        })
                        .eq('id', newChatId)
                        .eq('user_id', user.id)

                    console.log('✅ Successfully stored messages')
                } catch (error) {
                    console.error('❌ Error in message handling:', error)
                    throw error
                }
            },
        })

        return result.toDataStreamResponse({
            headers: {
                'x-chat-id': newChatId,
                'x-app-id': appId || '',
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        })
    } catch (error) {
        console.error('❌ Error in stream route:', error)
        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        )
    }
}

export const runtime = 'nodejs'
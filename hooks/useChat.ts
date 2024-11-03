import { mapVercelToClientMessage } from '@/lib/mappers'
import modelsList from '@/lib/models.json'
import { DatabaseMessage, LLMModelConfig } from '@/lib/types'
import {
    createClientComponentClient,
    Session,
} from '@supabase/auth-helpers-nextjs'
import { Message, useChat as useVercelChat } from 'ai/react'
import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

// Define type for tool calls to fix the map error
interface ToolCallData {
    id: string
    name: string
    parameters: Record<string, unknown>
}

export function useChat(chatId: string | null) {
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClientComponentClient()
    const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false)

    // States
    const [csvContent, setCsvContent] = useState<string | null>(null)
    const [csvFileName, setCsvFileName] = useState<string | null>(null)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [generatedCode, setGeneratedCode] = useState('')
    const [streamingMessage, setStreamingMessage] = useState('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [localMessages, setLocalMessages] = useState<Message[]>([])

    // Language model configuration
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20240620',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Initialize Supabase session
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    // Initialize Vercel AI SDK chat
    const {
        messages: vercelMessages,
        input,
        handleInputChange,
        handleSubmit: vercelHandleSubmit,
        isLoading,
        error,
        append,
        reload,
        stop,
        setMessages: setVercelMessages,
    } = useVercelChat({
        api: `/api/conversations/${chatId}/stream`,
        id: chatId || undefined,
        initialMessages: [],
        body: {
            model: currentModel,
            config: languageModel,
        },
        onResponse: (response) => {
            const reader = response.body?.getReader()
            if (!reader) return

            const processStream = async () => {
                const decoder = new TextDecoder()
                try {
                    console.log('🔄 Starting stream processing')
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) {
                            console.log('✅ Stream complete')
                            break
                        }

                        const chunk = decoder.decode(value)
                        try {
                            const parsed = JSON.parse(chunk)
                            console.log('🔍 Parsed chunk type:', parsed.type)

                            switch (parsed.type) {
                                case 'text-delta':
                                    setStreamingMessage((prev) => {
                                        const newContent =
                                            parsed.content || parsed.delta || ''
                                        return prev + newContent
                                    })
                                    break
                                case 'generated_code':
                                    setGeneratedCode(parsed.content)
                                    setIsGeneratingCode(true)
                                    break
                                case 'tool-call':
                                    if (
                                        parsed.name === 'create_streamlit_app'
                                    ) {
                                        setIsGeneratingCode(true)
                                    }
                                    break
                                case 'tool-result':
                                    if (
                                        parsed.name === 'create_streamlit_app'
                                    ) {
                                        setGeneratedCode(parsed.content)
                                        setIsGeneratingCode(false)
                                    }
                                    break
                            }
                        } catch (e) {
                            console.log('📄 Raw text chunk:', chunk)
                            setStreamingMessage((prev) => prev + chunk)
                        }
                    }
                } catch (error) {
                    console.error('❌ Error processing stream:', error)
                } finally {
                    console.log('🏁 Stream processing complete')
                    setIsGeneratingCode(false)
                }
            }

            processStream()
        },
        onFinish: async (message) => {
            if (!chatId || !session?.user?.id) return

            try {
                const clientMessage = mapVercelToClientMessage(message)
                const response = await fetch(
                    `/api/conversations/${chatId}/messages`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            user_id: session.user.id,
                            role: message.role,
                            user_message:
                                message.role === 'user' ? message.content : '',
                            assistant_message:
                                message.role === 'assistant'
                                    ? message.content
                                    : '',
                            tool_calls: clientMessage.toolInvocations?.filter(
                                (t) => t.state === 'call'
                            ),
                            tool_results: clientMessage.toolInvocations?.filter(
                                (t) => t.state === 'result'
                            ),
                            created_at: new Date().toISOString(),
                        }),
                    }
                )

                if (!response.ok) {
                    throw new Error('Failed to store message')
                }

                setStreamingMessage('')
                await fetchMessages()
            } catch (error) {
                console.error('Error handling message:', error)
            }
        },
    })

    // Function to fetch messages from database
    const fetchMessages = async () => {
        if (!chatId) {
            console.log('❌ No chatId available for fetching messages')
            return
        }

        try {
            console.log('🔍 Fetching messages for chat:', chatId)
            const response = await fetch(
                `/api/conversations/${chatId}/messages`
            )
            if (!response.ok) {
                throw new Error('Failed to fetch messages')
            }

            const { messages: dbMessages } = await response.json()
            console.log('📦 Raw messages from database:', dbMessages)

            // Map each database message to user and assistant messages
            const mappedMessages = dbMessages.flatMap((msg: DatabaseMessage) => {
                const messages = []

                // Add user message if it exists
                if (msg.user_message) {
                    messages.push({
                        id: `${msg.id}-user`,
                        role: 'user',
                        content: msg.user_message,
                        createdAt: new Date(msg.created_at)
                    })
                }

                // Add assistant message if it exists
                if (msg.assistant_message) {
                    messages.push({
                        id: `${msg.id}-assistant`,
                        role: 'assistant',
                        content: msg.assistant_message,
                        createdAt: new Date(msg.created_at),
                        toolInvocations: msg.tool_calls
                            ? (msg.tool_calls as unknown as ToolCallData[]).map(
                                  (call) => ({
                                      state: 'call' as const,
                                      toolCallId: call.id,
                                      toolName: call.name,
                                      args: call.parameters,
                                  })
                              )
                            : undefined,
                    })
                }

                return messages
            })

            console.log('📊 Mapped messages:', mappedMessages)
            setVercelMessages(mappedMessages)
            setInitialMessagesLoaded(true)

        } catch (error) {
            console.error('❌ Error in fetchMessages:', error)
        }
    }

    // Load initial messages with debounce
    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        if (chatId && !initialMessagesLoaded) {
            console.log('🔄 Initializing message fetch for chat:', chatId)
            timeoutId = setTimeout(() => {
                fetchMessages()
            }, 100)
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [chatId, initialMessagesLoaded])

    // Custom submit handler with better error handling
    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            if (!chatId) {
                console.warn('No chat ID available')
                return
            }

            try {
                // Remove the local message addition since it will be handled by the API
                await vercelHandleSubmit(e)
            } catch (error) {
                console.error('Error in submit:', error)
            }
        },
        [chatId, vercelHandleSubmit]
    )

    // File upload handler
    const handleFileUpload = useCallback(
        async (content: string, fileName: string) => {
            if (!chatId || !sandboxId || !session?.user?.id) return

            try {
                const fileData = await uploadAndAnalyzeFile(
                    content,
                    fileName,
                    chatId,
                    sandboxId
                )

                await append({
                    role: 'user',
                    content: `I've uploaded a CSV file named "${fileName}". Can you analyze it and create a Streamlit app? CSV Analysis: ${JSON.stringify(fileData.analysis)}`,
                    id: Date.now().toString(),
                    createdAt: new Date(),
                })

                setCsvContent(content)
                setCsvFileName(fileName)
            } catch (error) {
                console.error('Error in file upload:', error)
            }
        },
        [chatId, sandboxId, session?.user?.id, append]
    )

    // Initialize sandbox
    useEffect(() => {
        if (chatId) {
            fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
                .then((res) => res.json())
                .then((data) => setSandboxId(data.sandboxId))
                .catch(console.error)
        }
    }, [chatId])

    return {
        messages: vercelMessages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        handleFileUpload,
        csvContent,
        csvFileName,
        streamlitUrl,
        generatedCode,
        streamingMessage,
        isGeneratingCode,
        sandboxErrors: [],
        sandboxId,
        error,
        stop,
        reload,
        setMessages: setVercelMessages,
    }
}

// Helper function for file upload and analysis
async function uploadAndAnalyzeFile(
    content: string,
    fileName: string,
    chatId: string,
    sandboxId: string
) {
    const fileResponse = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            file_name: fileName,
            content: content,
            sandbox_id: sandboxId,
        }),
    })

    if (!fileResponse.ok) throw new Error('Failed to upload file')
    const fileData = await fileResponse.json()

    const analysisResponse = await fetch(`/api/files/${fileData.id}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ fileContent: content }),
    })

    if (!analysisResponse.ok) throw new Error('Failed to analyze file')
    return await analysisResponse.json()
}

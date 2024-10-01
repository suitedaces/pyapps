import {
    ClientMessage,
    Message,
    StreamChunk,
    ToolCall,
    ToolResult,
} from '@/lib/types'
import {
    createClientComponentClient,
    Session,
} from '@supabase/auth-helpers-nextjs'
import { useCallback, useEffect, useState } from 'react'

export function useChat(chatId: string | null) {
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClientComponentClient()
    const [input, setInput] = useState('')
    const [csvContent, setCsvContent] = useState<string | null>(null)
    const [csvFileName, setCsvFileName] = useState<string | null>(null)
    const [messages, setMessages] = useState<ClientMessage[]>([])
    const [streamingMessage, setStreamingMessage] = useState<string>('')
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setIsLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setIsLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])
    
    const resetState = useCallback(() => {
        setMessages([])
        setCsvContent(null)
        setCsvFileName(null)
        setStreamingMessage('')
        setSandboxId(null)
        setStreamlitUrl(null)
        setGeneratedCode('') // Reset the generated code state
    }, [])

    const initializeSandbox = useCallback(async () => {
        try {
            const response = await fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            setSandboxId(data.sandboxId)
            console.log('Sandbox initialized with ID:', data.sandboxId)
        } catch (error) {
            console.error('Error initializing sandbox:', error)
        }
    }, [chatId])

    useEffect(() => {
        if (chatId) {
            initializeSandbox()
            fetchMessages(chatId)
        } else {
            resetState()
        }
    }, [chatId, initializeSandbox, resetState])

    const fetchMessages = async (id: string) => {
        try {
            const response = await fetch(`/api/conversations/${id}/messages`)
            if (!response.ok) {
                throw new Error('Failed to fetch messages')
            }
            const data: Message[] = await response.json()
            const clientMessages: ClientMessage[] = data.flatMap((msg) => [
                {
                    role: 'user',
                    content: msg.user_message,
                    created_at: new Date(msg.created_at),
                },
                {
                    role: 'assistant',
                    content: msg.assistant_message,
                    created_at: new Date(msg.created_at),
                    tool_calls: msg.tool_calls as ToolCall[] | undefined,
                    tool_results: msg.tool_results as ToolResult[] | undefined,
                },
            ])
            setMessages(clientMessages)
        } catch (error) {
            console.error('Error fetching messages:', error)
        }
    }

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setInput(e.target.value)
        },
        []
    )

    const updateStreamlitApp = useCallback(async (code: string) => {
        if (code && sandboxId) {
            try {
                console.log('Updating Streamlit app with code:', code)
                const response = await fetch(
                    `/api/sandbox/${sandboxId}/execute`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code }),
                    }
                )

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const data = await response.json()
                if (data.url) {
                    setStreamlitUrl(data.url)
                    console.log('Streamlit URL updated:', data.url)
                } else {
                    throw new Error('No URL returned from sandbox API')
                }
            } catch (error) {
                console.error('Error updating Streamlit app:', error)
            }
        } else {
            console.error('Generated code not available or sandbox not initialized')
        }
    }, [sandboxId])

    const processStreamChunk = useCallback(
        (chunk: StreamChunk) => {
            switch (chunk.type) {
                case 'content_block_delta':
                    if ('delta' in chunk && chunk.delta?.type === 'text_delta') {
                        setStreamingMessage(prev => prev + chunk.delta.text)
                    }
                    break
                case 'generated_code': // Handle the generated code case
                    if ('content' in chunk) {
                        setGeneratedCode(prev => prev + chunk.content)
                        setIsGeneratingCode(true)
                        updateStreamlitApp(chunk.content as string)
                    }
                    break
                case 'tool_use':
                    setMessages(prev => {
                        const lastMessage = prev[prev.length - 1]
                        if (lastMessage.role === 'assistant') {
                            const updatedToolCalls = [...(lastMessage.tool_calls || []), chunk.content]
                            return [...prev.slice(0, -1), { ...lastMessage, tool_calls: updatedToolCalls }]
                        }
                        return prev
                    })
                    break
                case 'message_stop':
                    setMessages(prev => [
                        ...prev,
                        {
                            role: 'assistant',
                            content: streamingMessage,
                            created_at: new Date(),
                            tool_calls: prev[prev.length - 1]?.tool_calls,
                            tool_results: prev[prev.length - 1]?.tool_results,
                        },
                    ])
                    setStreamingMessage('')
                    setIsGeneratingCode(false)
                    break
            }
        },
        [streamingMessage, updateStreamlitApp]
    )

    const handleChatOperation = useCallback(
        async (newMessage: ClientMessage) => {
            if (isLoading || !session || !chatId) {
                console.error(
                    'User not authenticated, session is loading, or no chat selected'
                )
                return
            }

            setStreamingMessage('')

            try {
                const response = await fetch(
                    `/api/conversations/${chatId}/stream`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: newMessage.content }),
                    }
                )

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const reader = response.body?.getReader()
                if (!reader) {
                    throw new Error('Failed to get response reader')
                }

                const decoder = new TextDecoder()
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\n').filter(line => line.trim() !== '')
                    for (const line of lines) {
                        processStreamChunk(JSON.parse(line))
                    }
                }
            } catch (error) {
                console.error('Error in chat operation:', error)
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: 'An error occurred. Please try again.',
                        created_at: new Date(),
                    },
                ])
            } finally {
                setIsLoading(false)
            }
        },
        [session, isLoading, chatId, processStreamChunk]
    )

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            if (!input.trim()) return

            const newUserMessage: ClientMessage = {
                role: 'user',
                content: input,
                created_at: new Date(),
            }
            setMessages(prev => [...prev, newUserMessage])
            setInput('')

            await handleChatOperation(newUserMessage)
        },
        [input, handleChatOperation]
    )

    const handleFileUpload = useCallback(
        async (content: string, fileName: string) => {
            const sanitizeCSVContent = (content: string): string => {
                return content
                    .split('\n')
                    .map((row) => row.replace(/[\r\n]+/g, ''))
                    .join('\n')
            }

            const sanitizedContent = sanitizeCSVContent(content)
            setCsvContent(sanitizedContent)
            setCsvFileName(fileName)

            try {
                const response = await fetch('/api/files', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        file_name: fileName,
                        file_type: 'csv',
                        file_url: `/home/user/${fileName}`,
                        backup_url: 'placeholder_url',
                        file_size: sanitizedContent.length,
                        content_hash: sanitizedContent,
                        analysis: null,
                        sandbox_id: sandboxId,
                        expires_at: new Date(Date.now() + 1 * 60 * 1000),
                    }),
                })

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const data = await response.json()
                console.log('CSV uploaded and stored:', data)

                const analysisResponse = await fetch(
                    `/api/files/${data.id}/analyze`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileContent: sanitizedContent }),
                    }
                )

                if (!analysisResponse.ok) {
                    throw new Error(
                        `HTTP error! status: ${analysisResponse.status}`
                    )
                }

                const analysisData = await analysisResponse.json()
                console.log('CSV analyzed:', analysisData)

                const newUserMessage: ClientMessage = {
                    role: 'user',
                    content: `I've uploaded a CSV file named "${fileName}". Can you analyze it and create a Streamlit app to visualize the data? The file is located at '/home/user/${fileName}' in the sandbox.`,
                    created_at: new Date(),
                }

                setMessages(prev => [...prev, newUserMessage])
                await handleChatOperation(newUserMessage)
            } catch (error) {
                console.error('Error in file upload:', error)
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: `There was an error uploading the file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
                        created_at: new Date(),
                    },
                ])
            }
        },
        [chatId, sandboxId, handleChatOperation]
    )

    return {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        handleFileUpload,
        csvContent,
        csvFileName,
        streamingMessage,
        sandboxId,
        streamlitUrl,
        generatedCode,  // Return the generated code
        isGeneratingCode,
    }
}

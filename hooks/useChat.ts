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

import { LLMModelConfig } from '@/lib/modelProviders'
import modelsList from '@/lib/models.json'
import { useLocalStorage } from 'usehooks-ts'

export function useChat(chatId: string | null) {
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClientComponentClient()
    const [input, setInput] = useState('')
    const [csvContent, setCsvContent] = useState<string | null>(null)
    const [csvFileName, setCsvFileName] = useState<string | null>(null)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [generatedCode, setGeneratedCode] = useState('')
    const [messages, setMessages] = useState<ClientMessage[]>([])
    const [streamingMessage, setStreamingMessage] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [codeExplanation, setCodeExplanation] = useState('')
    const [sandboxErrors, setSandboxErrors] = useState<any[]>([])
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [isMessagesLoading, setIsMessagesLoading] = useState(false)
    const [isCreatingChat, setIsCreatingChat] = useState(false)

    const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
        'languageModel',
        {
            model: 'claude-3-5-sonnet-20240620',
        }
    )

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    console.log(currentModel);


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

    useEffect(() => {
        if (chatId) {
            initializeSandbox()
            fetchMessages(chatId)
        } else {
            resetState()
        }
    }, [chatId])

    const resetState = () => {
        setMessages([])
        setCsvContent(null)
        setCsvFileName(null)
        setStreamlitUrl(null)
        setGeneratedCode('')
        setStreamingMessage('')
        setCodeExplanation('')
        setSandboxErrors([])
        setSandboxId(null)
    }

    const initializeSandbox = useCallback(async () => {
        try {
            const response = await fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            setSandboxId(data.sandboxId)
            console.log('Sandbox initialized with ID:', data.sandboxId)
            return data.sandboxId
        } catch (error) {
            console.error('Error initializing sandbox:', error)
            setSandboxErrors((prev) => [
                ...prev,
                { message: 'Error initializing sandbox' },
            ])
            throw error
        }
    }, [])

    const fetchMessages = async (id: string) => {
        if (isMessagesLoading) return;

        setIsMessagesLoading(true);
        try {
            const response = await fetch(`/api/conversations/${id}/messages`)
            if (!response.ok) {
                throw new Error('Failed to fetch messages')
            }
            const data: Message[] = await response.json()

            const clientMessages: ClientMessage[] = data.flatMap((msg) => {
                const messages: ClientMessage[] = [
                    {
                        role: 'user',
                        content: msg.user_message,
                        created_at: new Date(msg.created_at),
                    },
                ]

                if (msg.assistant_message) {
                    messages.push({
                        role: 'assistant',
                        content: msg.assistant_message,
                        created_at: new Date(msg.created_at),
                        tool_calls: msg.tool_calls,
                        tool_results: msg.tool_results,
                    })
                }

                return messages
            })

            if (clientMessages.length > 0) {
                setMessages(clientMessages)
            }
        } catch (error) {
            console.error('Error fetching messages:', error)
        } finally {
            setIsMessagesLoading(false)
        }
    }

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setInput(e.target.value)
        },
        []
    )

    const updateStreamlitApp = useCallback(
        async (code: string) => {
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
                        throw new Error(
                            `HTTP error! status: ${response.status}`
                        )
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
                    setSandboxErrors((prev) => [
                        ...prev,
                        { message: 'Error updating Streamlit app' },
                    ])
                } finally {
                    setIsGeneratingCode(false)
                }
            } else {
                console.error(
                    'Generated code not available or sandbox not initialized'
                )
            }
        },
        [sandboxId]
    )

    const processStreamChunk = useCallback(
        (
            chunk: string,
            accumulatedResponse: string,
            accumulatedCode: string
        ) => {
            try {
                console.log('Processing chunk:', chunk)
                const parsedChunk: StreamChunk = JSON.parse(chunk)

                // Text delta handling
                if (
                    parsedChunk.type === 'text-delta' &&
                    parsedChunk.textDelta
                ) {
                    setStreamingMessage((prev) => prev + parsedChunk.textDelta)
                    return {
                        accumulatedResponse:
                            accumulatedResponse + parsedChunk.textDelta,
                        accumulatedCode,
                    }
                }

                // Generated code handling
                else if (
                    parsedChunk.type === 'generated_code' &&
                    parsedChunk.content
                ) {
                    setGeneratedCode((prev) => prev + parsedChunk.content)
                    return {
                        accumulatedResponse,
                        accumulatedCode: accumulatedCode + parsedChunk.content,
                    }
                }

                // Tool call handling
                else if (parsedChunk.type === 'tool-call') {
                    if (
                        typeof parsedChunk.content === 'object' &&
                        parsedChunk.content?.name === 'create_streamlit_app'
                    ) {
                        setIsGeneratingCode(true)
                    }
                    return { accumulatedResponse, accumulatedCode } // Added return
                }

                // Finish handling
                else if (parsedChunk.type === 'finish') {
                    setIsGeneratingCode(false)
                    return { accumulatedResponse, accumulatedCode } // Added return
                }

                // Error handling
                else if (parsedChunk.type === 'error' && parsedChunk.content) {
                    console.error('Stream error:', parsedChunk.content)
                    return { accumulatedResponse, accumulatedCode } // Added return
                }

                return { accumulatedResponse, accumulatedCode } // Default return
            } catch (error) {
                console.error('Error processing stream chunk:', error)
                return { accumulatedResponse, accumulatedCode } // Error case return
            }
        },
        []
    )

    const processStream = useCallback(
        async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
            const decoder = new TextDecoder()
            let accumulatedResponse = ''
            let accumulatedCode = ''

            console.log('Starting stream processing...')

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) {
                        console.log(
                            'Stream completed. Final accumulated response:',
                            accumulatedResponse
                        )
                        break
                    }

                    const chunk = decoder.decode(value)
                    console.log('Raw chunk received:', chunk)

                    const lines = chunk
                        .split('\n')
                        .filter((line) => line.trim() !== '')

                    console.log('Processing lines:', lines)

                    for (const line of lines) {
                        console.log('Processing individual line:', line)
                        const result = processStreamChunk(
                            line,
                            accumulatedResponse,
                            accumulatedCode
                        )
                        // Update local variables with returned values
                        accumulatedResponse = result.accumulatedResponse
                        accumulatedCode = result.accumulatedCode

                        console.log('After processing line:')
                        console.log(
                            '- Accumulated Response:',
                            accumulatedResponse
                        )
                        console.log('- Accumulated Code:', accumulatedCode)
                    }
                }
            } catch (error) {
                console.error('Error in processStream:', error)
            }

            console.log('Stream processing finished')
            console.log('Final accumulated response:', accumulatedResponse)
            console.log('Final accumulated code:', accumulatedCode)

            // Return final accumulated values
            return {
                accumulatedResponse: accumulatedResponse || streamingMessage,
                accumulatedCode,
            }
        },
        [processStreamChunk, streamingMessage]
    )

    const handleChatOperation = useCallback(
        async (newMessage: ClientMessage, newChatId: string | null) => {
            if (isLoading || !session) {
                console.error('User not authenticated or session is loading')
                return
            }

            if (!newChatId) {
                console.error('No chat ID available')
                return
            }

            setStreamingMessage('')
            setGeneratedCode('')
            setCodeExplanation('')
            setSandboxErrors([])

            const currentMessages = [...messages, newMessage];
            setMessages(currentMessages);

            try {
                setIsCreatingChat(true)

                const requestBody = JSON.stringify({
                    message: newMessage.content,
                    model: currentModel,
                    config: languageModel,
                })

                const response = await fetch(
                    `/api/conversations/${newChatId}/stream`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: requestBody,
                    }
                )

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const reader = response.body?.getReader()
                if (!reader) {
                    throw new Error('Failed to get response reader')
                }

                const { accumulatedResponse, accumulatedCode } =
                    await processStream(reader)

                const assistantMessage: ClientMessage = {
                    role: 'assistant',
                    content: accumulatedResponse,
                    created_at: new Date(),
                }

                setMessages([...currentMessages, assistantMessage])

                setStreamingMessage('')

                if (accumulatedCode) {
                    setGeneratedCode(accumulatedCode)
                    console.log('Generated code:', accumulatedCode)
                    await updateStreamlitApp(accumulatedCode)
                }

                if (codeExplanation) {
                    const explanationMessage: ClientMessage = {
                        role: 'assistant',
                        content: codeExplanation,
                        created_at: new Date(),
                    }
                    setMessages([...currentMessages, explanationMessage])
                }
            } catch (error) {
                console.error('Error in chat operation:', error)
                setMessages([...currentMessages, {
                    role: 'assistant',
                    content: 'An error occurred during the operation.',
                    created_at: new Date()
                }])
            } finally {
                setIsCreatingChat(false)
            }
        },
        [session, processStream, updateStreamlitApp, codeExplanation, messages]
    )

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>, newChatId?: string | null) => {
            e.preventDefault()
            if (!input.trim()) return

            const newUserMessage: ClientMessage = {
                role: 'user',
                content: input,
                created_at: new Date(),
            }

            // Store the message first
            setMessages(prev => [...prev, newUserMessage])
            setInput('')

            const chatIdToUse = newChatId || chatId
            if (!chatIdToUse) {
                console.error('No chat ID available')
                return
            }

            try {
                // Keep track of messages during chat operation
                await handleChatOperation(newUserMessage, chatIdToUse)
            } catch (error) {
                console.error('Error in submit:', error)
                // If error occurs, keep the user message in state
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: 'An error occurred. Please try again.',
                        created_at: new Date(),
                    },
                ])
            }
        },
        [input, handleChatOperation, chatId]
    )

    useEffect(() => {
        if (chatId) {
            fetchMessages(chatId)
        }
    }, [chatId])

    const handleFileUpload = useCallback(
        async (content: string, fileName: string) => {
            // First ensure we have a chat ID
            let activeChatId = chatId;

            if (!activeChatId) {
                try {
                    console.log('Creating new chat for file upload...');
                    const response = await fetch('/api/conversations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: `CSV Analysis: ${fileName}`,
                            created_at: new Date().toISOString()
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to create new chat');
                    }

                    const data = await response.json();
                    activeChatId = data.id;
                    console.log('Created new chat with ID:', activeChatId);
                } catch (error) {
                    console.error('Error creating chat:', error);
                    throw new Error('Failed to create chat for file upload');
                }
            }

            // Then initialize sandbox if needed
            let currentSandboxId = sandboxId;
            if (!currentSandboxId) {
                try {
                    console.log('Initializing sandbox...');
                    currentSandboxId = await initializeSandbox();
                    if (!currentSandboxId) {
                        throw new Error('Failed to get sandbox ID after initialization');
                    }
                    console.log('Sandbox initialized with ID:', currentSandboxId);
                } catch (error) {
                    console.error('Failed to initialize sandbox:', error);
                    throw new Error('Failed to initialize sandbox');
                }
            }

            const sanitizeCSVContent = (content: string): string => {
                return content
                    .split('\n')
                    .map((row) => row.replace(/[\r\n]+/g, ''))
                    .join('\n');
            };

            const sanitizedContent = sanitizeCSVContent(content);
            setCsvContent(sanitizedContent);
            setCsvFileName(fileName);

            try {
                console.log('Uploading file with params:', {
                    chatId: activeChatId,
                    sandboxId: currentSandboxId,
                    fileName
                });

                const response = await fetch('/api/files', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: activeChatId,
                        file_name: fileName,
                        file_type: 'csv',
                        file_url: `/home/user/${fileName}`,
                        backup_url: 'placeholder_url',
                        file_size: sanitizedContent.length,
                        content_hash: sanitizedContent,
                        analysis: null,
                        sandbox_id: currentSandboxId,
                        expires_at: new Date(Date.now() + 1 * 60 * 1000),
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log('File uploaded successfully:', data);

                // Continue with analysis and message handling
                const analysisResponse = await fetch(
                    `/api/files/${data.id}/analyze`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileContent: sanitizedContent }),
                    }
                );

                if (!analysisResponse.ok) {
                    throw new Error(`Analysis failed with status: ${analysisResponse.status}`);
                }

                const analysisData = await analysisResponse.json();
                console.log('CSV analyzed:', analysisData);

                const newUserMessage: ClientMessage = {
                    role: 'user',
                    content: `I've uploaded a CSV file named "${fileName}". Can you analyze it and create a complex, aesthetic Streamlit app to visualize the data? Make sure to use the exact column names when reading the CSV in your code. The file is located at '/home/user/${fileName}' in the sandbox. CSV Analysis: ${analysisData}`,
                    created_at: new Date(),
                };

                setMessages(prev => [...prev, newUserMessage]);
                await handleChatOperation(newUserMessage, activeChatId);

            } catch (error) {
                console.error('Error in file upload:', error);
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: `There was an error uploading the file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
                        created_at: new Date(),
                    },
                ]);
                setSandboxErrors((prev) => [
                    ...prev,
                    { message: 'Error uploading file' },
                ]);
                throw error;
            }
        },
        [chatId, sandboxId, initializeSandbox, handleChatOperation, setMessages]
    );

    return {
        messages,
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
        streamingCodeExplanation: codeExplanation,
        sandboxErrors,
        sandboxId,
        isCreatingChat,
    }
}

import { Message, useChat as useVercelChat } from 'ai/react'
import { createClientComponentClient, Session } from '@supabase/auth-helpers-nextjs'
import { useCallback, useEffect, useState } from 'react'
import { LLMModelConfig } from '@/lib/types'
import modelsList from '@/lib/models.json'
import { useLocalStorage } from 'usehooks-ts'
import { ClientMessage } from '@/lib/types'

export function useChat(chatId: string | null) {
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClientComponentClient()

    // Initialize session
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

    // States
    const [csvContent, setCsvContent] = useState<string | null>(null)
    const [csvFileName, setCsvFileName] = useState<string | null>(null)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [generatedCode, setGeneratedCode] = useState('')
    const [streamingMessage, setStreamingMessage] = useState('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [sandboxId, setSandboxId] = useState<string | null>(null)

    // Language model configuration
    const [languageModel] = useLocalStorage<LLMModelConfig>(
        'languageModel',
        { model: 'claude-3-5-sonnet-20240620' }
    )

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Initialize Vercel AI SDK chat
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit: vercelHandleSubmit,
        isLoading,
        error,
        append,
        reload,
        stop,
        setMessages
    } = useVercelChat({
        api: `/api/conversations/${chatId}/stream`,
        id: chatId || undefined,
        body: {
            model: currentModel,
            config: languageModel
        },
        onResponse: (response) => {
            const reader = response.body?.getReader()
            if (!reader) return

            const processStream = async () => {
                const decoder = new TextDecoder()
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        const chunk = decoder.decode(value)
                        try {
                            const parsed = JSON.parse(chunk)
                            if (parsed.type === 'generated_code') {
                                setGeneratedCode(parsed.content)
                                setIsGeneratingCode(true)
                            } else if (parsed.type === 'text-delta') {
                                setStreamingMessage(prev => prev + parsed.delta)
                            }
                        } catch (e) {
                            // Regular text chunk
                            setStreamingMessage(prev => prev + chunk)
                        }
                    }
                } catch (error) {
                    console.error('Error processing stream:', error)
                } finally {
                    setIsGeneratingCode(false)
                }
            }

            processStream()
        },
        onFinish: async (message) => {
            if (!chatId || !session?.user?.id) return

            try {
                await fetch(`/api/conversations/${chatId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        user_id: session.user.id,
                        user_message: message.role === 'user' ? message.content : '',
                        assistant_message: message.role === 'assistant' ? message.content : '',
                        tool_calls: message.tool_calls || [],
                        tool_results: [],
                        created_at: new Date().toISOString()
                    })
                })
            } catch (error) {
                console.error('Error storing message:', error)
            }
        }
    })

    // File upload handler
    const handleFileUpload = useCallback(async (content: string, fileName: string) => {
        if (!chatId || !sandboxId || !session?.user?.id) return

        try {
            // Upload and analyze file
            const fileData = await uploadAndAnalyzeFile(content, fileName, chatId, sandboxId)

            // Create message about uploaded file
            await append({
                role: 'user',
                content: `I've uploaded a CSV file named "${fileName}". Can you analyze it and create a Streamlit app? CSV Analysis: ${JSON.stringify(fileData.analysis)}`,
                id: Date.now().toString(),
                createdAt: new Date()
            })

            setCsvContent(content)
            setCsvFileName(fileName)

        } catch (error) {
            console.error('Error in file upload:', error)
        }
    }, [chatId, sandboxId, session, append])

    return {
        messages,
        input,
        handleInputChange,
        handleSubmit: vercelHandleSubmit,
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
        setMessages
    }
}

// Helper function for file upload and analysis
async function uploadAndAnalyzeFile(content: string, fileName: string, chatId: string, sandboxId: string) {
    const fileResponse = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            file_name: fileName,
            content: content,
            sandbox_id: sandboxId
        })
    })

    if (!fileResponse.ok) throw new Error('Failed to upload file')
    const fileData = await fileResponse.json()

    const analysisResponse = await fetch(`/api/files/${fileData.id}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ fileContent: content })
    })

    if (!analysisResponse.ok) throw new Error('Failed to analyze file')
    return await analysisResponse.json()
}

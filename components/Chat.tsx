'use client'

import Chatbar from '@/components/core/chatbar'
import { Message as AIMessage } from '@/components/core/message'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import modelsList from '@/lib/models.json'
import { LLMModelConfig } from '@/lib/types'
import { Message } from 'ai'
import { useChat } from 'ai/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

interface ChatProps {
    chatId?: string | null
    initialMessages?: Message[]
    onChatCreated?: (chatId: string) => void
    onFileSelect?: (file: { content: string; name: string }) => void
    onUpdateStreamlit?: (message: string) => void
    onChatSubmit?: () => void
    onChatFinish?: () => void
}

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

export function Chat({
    chatId = null,
    initialMessages = [],
    onChatCreated,
    onFileSelect,
    onUpdateStreamlit,
    onChatSubmit,
    onChatFinish,
}: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [errorState, setErrorState] = useState<Error | null>(null)
    const [attachedFile, setAttachedFile] = useState<File | null>(null)
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        isUploading: false,
        progress: 0,
        error: null,
    })

    const newChatIdRef = useRef<string | null>(null)

    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20241022',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    const {
        messages: aiMessages,
        input,
        handleInputChange,
        handleSubmit: originalHandleSubmit,
        isLoading,
        setMessages: setAiMessages,
        append,
    } = useChat({
        api: chatId
            ? `/api/conversations/${chatId}/stream`
            : '/api/conversations/stream',
        id: chatId ?? undefined,
        initialMessages,
        body: {
            model: currentModel,
            config: languageModel,
        },
        onResponse: async (response) => {
            if (!response.ok) {
                handleResponseError(response)
                return
            }

            if (!chatId) {
                const newChatId = response.headers.get('x-chat-id')
                if (newChatId) {
                    newChatIdRef.current = newChatId
                }
            }
        },
        onFinish: async (message) => {
            setErrorState(null)
            setAttachedFile(null)
            resetFileUploadState()
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }

            if (
                message.role === 'assistant' &&
                !chatId &&
                newChatIdRef.current
            ) {
                onChatCreated?.(newChatIdRef.current)
                newChatIdRef.current = null
            }

            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .filter(
                        (invocation) =>
                            invocation.toolName === 'create_streamlit_app' &&
                            invocation.state === 'result'
                    )
                    .pop()
            }

            onChatFinish?.()
        },
        onError: (error) => {
            handleChatError(error)
        },
    })

    const resetFileUploadState = () => {
        setFileUploadState({
            isUploading: false,
            progress: 0,
            error: null,
        })
    }

    const uploadFile = async (file: File): Promise<any> => {
        const formData = new FormData()
        formData.append('file', file)
        if (chatId) {
            formData.append('chatId', chatId)
        }

        const response = await fetch('/api/files', {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            throw new Error('Failed to upload file')
        }

        return await response.json()
    }

    const handleChatSubmit = async (content: string, file?: File) => {
        try {
            onChatSubmit?.()

            // Handle file upload case
            if (file) {
                const fileData = await uploadFile(file)
                const fileContent = await file.text()

                // Sanitize content
                const sanitizedContent = fileContent
                    .split('\n')
                    .map((row) => row.replace(/[\r\n]+/g, ''))
                    .join('\n')

                const rows = sanitizedContent.split('\n')
                const columnNames = rows[0]
                const previewRows = rows.slice(1, 6).join('\n')
                const dataPreview = `⚠️ EXACT column names:\n${columnNames}\n\nFirst 5 rows:\n${previewRows}`

                // const message = content.trim() ||
                //     `Create a Streamlit app to visualize this data from "/app/${file.name}". The file is at '/app/${file.name}'.\n${dataPreview}\nCreate a complex, aesthetic visualization using these exact column names.`;

                const message =
                    content.trim() ||
                    `Create a Streamlit app to visualize this data. The file is stored in the directory '/app/' and is named "${file.name}". Ensure all references to the file use the full path '/app/${file.name}'.\n${dataPreview}\nCreate a complex, aesthetic visualization using these exact column names.`

                await append(
                    {
                        content: message,
                        role: 'user',
                        createdAt: new Date(),
                    },
                    {
                        body: {
                            fileId: fileData.id,
                            fileName: file.name,
                            fileContent: sanitizedContent,
                        },
                    }
                )

                // Reset file state
                setAttachedFile(null)
                resetFileUploadState()
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
            }
            // Handle regular text message case
            else if (content.trim()) {
                await append({
                    content: content.trim(),
                    role: 'user',
                    createdAt: new Date(),
                })
            }
        } catch (error) {
            console.error('Error submitting message:', error)
            setFileUploadState((prev) => ({
                ...prev,
                error: 'Failed to send message. Please try again.',
            }))
        } finally {
            setFileUploadState((prev) => ({ ...prev, isUploading: false }))
        }
    }

    const messages = useMemo(() => {
        const messageMap = new Map()

        ;[...initialMessages, ...aiMessages].forEach((msg) => {
            const key = `${msg.role}:${msg.content}`
            if (
                !messageMap.has(key) ||
                (msg.createdAt &&
                    (!messageMap.get(key).createdAt ||
                        new Date(msg.createdAt) >
                            new Date(messageMap.get(key).createdAt)))
            ) {
                messageMap.set(key, msg)
            }
        })

        const dedupedMessages = Array.from(messageMap.values()).sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return timeA - timeB
        })

        return dedupedMessages
    }, [initialMessages, aiMessages])

    const handleResponseError = (response: Response) => {
        const errorMessage =
            response.status === 429
                ? 'Rate limit exceeded. Please wait a moment.'
                : response.status === 413
                  ? 'Message too long. Please try a shorter message.'
                  : 'An error occurred. Please try again.'

        setErrorState(new Error(errorMessage))
    }

    const handleChatError = (error: Error) => {
        if (!errorState) {
            const errorMessage = error.message.includes('Failed to fetch')
                ? 'Network error. Please check your connection.'
                : error.message
            setErrorState(new Error(errorMessage))
        }
    }

    const handleRetry = useCallback(async () => {
        setErrorState(null)
        if (
            messages.length > 0 &&
            messages[messages.length - 1].role === 'user'
        ) {
            try {
                await originalHandleSubmit(undefined as any)
            } catch (e) {
                console.error('Retry failed:', e)
            }
        }
    }, [messages, originalHandleSubmit])

    const handleTextareaChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            handleInputChange(e)
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
            }
        },
        [handleInputChange]
    )

    const isInputDisabled = !!attachedFile
    const placeholderText = attachedFile
        ? 'File attached. Remove file to type a message.'
        : 'Type your message...'

    return (
        <div className="flex flex-col h-full relative bg-background text-foreground border border-border rounded-2xl">
            <ScrollArea className="flex-grow p-4 space-y-4 w-full h-full max-w-[800px] m-auto">
                <AnimatePresence initial={false}>
                    {messages.map((message, index) => (
                        <div key={message.id}>
                            <AIMessage
                                {...message}
                                isLastMessage={index === messages.length - 1}
                            />
                        </div>
                    ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </ScrollArea>

            {errorState && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-4 text-center"
                >
                    <p className="text-red-500 mb-2">{errorState.message}</p>
                    <Button
                        onClick={() => setErrorState(null)}
                        variant="secondary"
                        size="sm"
                    >
                        Dismiss
                    </Button>
                </motion.div>
            )}

            {fileUploadState.error && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-4 text-center"
                >
                    <p className="text-red-500 mb-2">{fileUploadState.error}</p>
                    <Button
                        onClick={resetFileUploadState}
                        variant="secondary"
                        size="sm"
                    >
                        Dismiss
                    </Button>
                </motion.div>
            )}

            <Chatbar onSubmit={handleChatSubmit} isLoading={isLoading} />
        </div>
    )
}

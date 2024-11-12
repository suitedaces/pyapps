'use client'

import { useChat } from 'ai/react'
import { Message } from 'ai'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Code, Loader2, Send, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import modelsList from '@/lib/models.json'
import { LLMModelConfig } from '@/lib/types'
import { useLocalStorage } from 'usehooks-ts'
import { Message as AIMessage } from '@/components/core/message'
import { FilePreview } from './FilePreview'
import AIInput_15 from '@/components/kokonutui/chatbar'
import ChatBar from '@/components/kokonutui/chatbar'

interface ChatProps {
    chatId?: string | null
    initialMessages?: Message[]
    onChatCreated?: (chatId: string) => void
    onFileSelect?: (file: { content: string, name: string }) => void
    onUpdateStreamlit?: (message: string) => void
}

// File upload state interface
interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

// Core chat component that handles message streaming, UI rendering, and error states
export function Chat({ chatId = null, initialMessages = [], onChatCreated, onFileSelect, onUpdateStreamlit }: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [errorState, setErrorState] = useState<Error | null>(null)
    const [attachedFile, setAttachedFile] = useState<File | null>(null)
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        isUploading: false,
        progress: 0,
        error: null
    })

    const [currentChatId, setCurrentChatId] = useState<string | null>(chatId)
    const newChatIdRef = useRef<string | null>(null)

    // Get model configuration from localStorage
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20240620',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Initialize chat with Vercel AI SDK
    const {
        messages: aiMessages,
        input,
        handleInputChange,
        handleSubmit: originalHandleSubmit,
        isLoading,
        setMessages: setAiMessages,
        append,
    } = useChat({
        api: chatId ? `/api/conversations/${chatId}/stream` : '/api/conversations/stream',
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
                console.log('Response headers:', Object.fromEntries(response.headers))
                if (newChatId) {
                    console.log('Setting new chat ID:', newChatId)
                    newChatIdRef.current = newChatId
                    setCurrentChatId(newChatId)
                }
            }
        },
        onFinish: async (message) => {
            console.log('onFinish triggered with message:', message)
            setErrorState(null)
            setAttachedFile(null)
            resetFileUploadState()
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }

            if (message.role === 'assistant' && !chatId && newChatIdRef.current) {
                console.log('Creating chat with ID from ref:', newChatIdRef.current)
                onChatCreated?.(newChatIdRef.current)
                newChatIdRef.current = null
            }

            if (message.toolInvocations?.length) {
                console.log('Tool invocations found:', message.toolInvocations)
                const streamlitCall = message.toolInvocations
                    .filter(invocation =>
                        invocation.toolName === 'create_streamlit_app' &&
                        invocation.state === 'result'
                    )
                    .pop()

                if (streamlitCall?.state === 'result') {
                    console.log('Streamlit call successful')
                }
            }
        },
        onError: (error) => {
            console.error('Stream error:', error)
            handleChatError(error)
        }
    })

    const resetFileUploadState = () => {
        setFileUploadState({
            isUploading: false,
            progress: 0,
            error: null
        })
    }

    // TODO: Fix File upload handling
    const uploadFile = async (file: File): Promise<string> => {
        const formData = new FormData()
        formData.append('file', file)

        try {
            setFileUploadState(prev => ({ ...prev, isUploading: true }))

            const response = await fetch('/api/files', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                throw new Error('Failed to upload file')
            }

            const data = await response.json()
            return data.id
        } catch (error) {
            console.error('File upload error:', error)
            setFileUploadState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Upload failed'
            }))
            throw error
        } finally {
            setFileUploadState(prev => ({ ...prev, isUploading: false }))
        }
    }

    // Handle file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Reset any previous errors
        resetFileUploadState()

        // Basic file type validation
        const validExtensions = ['.csv', '.json', '.txt']
        const isValidType = validExtensions.some(ext =>
            file.name.toLowerCase().endsWith(ext)
        )

        if (!isValidType) {
            setFileUploadState(prev => ({
                ...prev,
                error: 'Invalid file type. Please upload a CSV, JSON, or TXT file.'
            }))
            return
        }

        try {
            const content = await file.text()
            setAttachedFile(file)
            onFileSelect?.({ content, name: file.name })
        } catch (error) {
            console.error('File selection error:', error)
            setFileUploadState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'File selection failed'
            }))
        }
    }

    // Handle file removal
    const handleRemoveFile = () => {
        setAttachedFile(null)
        resetFileUploadState()
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleChatSubmit = useCallback(async (content: string, file?: File) => {
        try {
            if (file) {
                const fileContent = await file.text()
                const rows = fileContent.split('\n')
                const columnNames = rows[0]
                const previewRows = rows.slice(1, 6).join('\n')
                const dataPreview = `⚠️ EXACT column names (copy exactly as shown):\n${columnNames}\n\nFirst 5 rows:\n${previewRows}`

                const message = `I've uploaded "${file.name}". Create a Streamlit app to visualize this data. The file is at '/app/${file.name}'.\n${dataPreview}\nCreate a complex, aesthetic visualization using these exact column names.`

                await onFileSelect?.({ content: fileContent, name: file.name })

                await append({
                    content: message,
                    role: 'user',
                    createdAt: new Date(),
                })
            } else if (content.trim()) {
                await append({
                    content,
                    role: 'user',
                    createdAt: new Date(),
                })
            }
        } catch (error) {
            console.error('Submit error:', error)
            setErrorState(new Error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
        }
    }, [append, onFileSelect])

    // Combine messages with proper deduplication and sorting
    const messages = useMemo(() => {
        const messageMap = new Map();

        [...initialMessages, ...aiMessages].forEach(msg => {
            const key = `${msg.role}:${msg.content}`;
            if (!messageMap.has(key) ||
                (msg.createdAt && (!messageMap.get(key).createdAt ||
                    new Date(msg.createdAt) > new Date(messageMap.get(key).createdAt)))) {
                messageMap.set(key, msg);
            }
        });

        const dedupedMessages = Array.from(messageMap.values())
            .sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeA - timeB;
            });

        return dedupedMessages;
    }, [initialMessages, aiMessages]);

    // Error handling functions
    const handleResponseError = (response: Response) => {
        const errorMessage = response.status === 429
            ? "Rate limit exceeded. Please wait a moment."
            : response.status === 413
                ? "Message too long. Please try a shorter message."
                : "An error occurred. Please try again."

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

    // Retry last message if error occurs
    const handleRetry = useCallback(async () => {
        setErrorState(null)
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
            try {
                await originalHandleSubmit(undefined as any)
            } catch (e) {
                console.error('Retry failed:', e)
            }
        }
    }, [messages, originalHandleSubmit])

    // Auto-resize textarea based on content
    const handleTextareaChange = useCallback((
        e: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
        handleInputChange(e)
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [handleInputChange])

    const isInputDisabled = !!attachedFile
    const placeholderText = attachedFile
        ? "File attached. Remove file to type a message."
        : "Type your message..."

    return (
        <div className="flex flex-col h-full relative dark:border-darkBorder border-2 border-border bg-white dark:bg-darkBg text-text dark:text-darkText">
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

            <ChatBar
                handleSubmit={handleChatSubmit}
                isLoading={isLoading}
            />
        </div>
    )
}

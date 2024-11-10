'use client'

import { useChat } from 'ai/react'
import { Message } from 'ai'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Code, Loader2, Send, Paperclip } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import modelsList from '@/lib/models.json'
import { useRouter } from 'next/navigation'
import { LLMModelConfig } from '@/lib/types'
import { useLocalStorage } from 'usehooks-ts'
import { Message as AIMessage } from '@/components/core/message'
import { FilePreview } from './FilePreview'
import { z } from 'zod'

interface ChatProps {
    chatId?: string | null
    initialMessages?: Message[]
    onChatCreated?: (chatId: string) => void
    onFileSelect?: (file: File) => void
}

// File upload state interface
interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

// Core chat component that handles message streaming, UI rendering, and error states
export function Chat({ chatId = null, initialMessages = [], onChatCreated, onFileSelect }: ChatProps) {
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
                if (newChatId) {
                    onChatCreated?.(newChatId)
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

    // File upload handling
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

        try {
            setAttachedFile(file)
            onFileSelect?.(file)
            resetFileUploadState()
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

    // Handle form submission with file upload
    const handleSubmit = useCallback(
        async (e?: React.FormEvent<HTMLFormElement>) => {
            if (e) {
                e.preventDefault()
                e.stopPropagation()
            }

            try {
                let fileId: string | undefined

                if (attachedFile) {
                    // First upload the file
                    fileId = await uploadFile(attachedFile)

                    // Read and format file content for the message
                    const fileContent = await attachedFile.text()
                    const sanitizedContent = fileContent
                        .split('\n')
                        .map((row) => row.replace(/[\r\n]+/g, ''))
                        .join('\n')

                    const rows = sanitizedContent.split('\n')
                    const columnNames = rows[0]
                    const previewRows = rows.slice(1, 6).join('\n')
                    const dataPreview = `⚠️ EXACT column names (copy exactly as shown):\n${columnNames}\n\nFirst 5 rows:\n${previewRows}`

                    const message = `I've uploaded "${attachedFile.name}". Create a Streamlit app to visualize this data. The file is at '/home/user/${attachedFile.name}'.\n${dataPreview}\nCreate a complex, aesthetic visualization using these exact column names.`

                    await append({
                        content: message,
                        role: 'user',
                        createdAt: new Date(),
                    }, {
                        options: {
                            body: {
                                fileId,
                                fileName: attachedFile.name
                            }
                        }
                    })
                } else {
                    // Regular message without file
                    const message = input.trim()
                    if (!message) return

                    await append({
                        content: message,
                        role: 'user',
                        createdAt: new Date(),
                    })
                }

                handleRemoveFile()
            } catch (error) {
                console.error('Submit error:', error)
                setErrorState(new Error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
            }
        },
        [append, input, attachedFile]
    )

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

    // Auto-scroll to latest message
    useEffect(() => {
        if (messages.length > 0) {
            const timeoutId = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
            return () => clearTimeout(timeoutId)
        }
    }, [messages])

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

            <form
                onSubmit={handleSubmit}
                className="p-4 m-auto w-full max-w-[800px]"
            >
                {attachedFile && (
                    <div className="-mb-5">
                        <FilePreview
                            file={attachedFile}
                            onRemove={handleRemoveFile}
                            onError={(error) => setFileUploadState(prev => ({ ...prev, error }))}
                        />
                    </div>
                )}

                <div className="flex space-x-2">
                    <div className="relative flex-grow">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleTextareaChange}
                            placeholder={attachedFile ? "Add a message or press Send" : "Type your message..."}
                            className="relative flex w-full min-h-[80px] max-h-[200px] bg-bg rounded-3xl px-4 py-3 text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={fileUploadState.isUploading}
                        />
                        <div className="absolute right-2 bottom-2 flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept=".csv,.txt,.json"
                                disabled={fileUploadState.isUploading}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading || !!attachedFile || fileUploadState.isUploading}
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading || fileUploadState.isUploading || (!input.trim() && !attachedFile)}
                            >
                                {isLoading || fileUploadState.isUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}

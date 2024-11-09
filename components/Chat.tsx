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

interface ChatProps {
    chatId?: string | null
    initialMessages?: Message[]
    onChatCreated?: (chatId: string) => void
    onFileSelect?: (file: File) => void
}

// Core chat component that handles message streaming, UI rendering, and error states
export function Chat({ chatId = null, initialMessages = [], onChatCreated, onFileSelect }: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [errorState, setErrorState] = useState<Error | null>(null)
    const [attachedFile, setAttachedFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Get model configuration from localStorage
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20240620',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Initialize chat with Vercel AI SDK with experimental attachments
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
            console.log('🔄 Stream response initiated:', {
                status: response.status,
                headers: Array.from(response.headers.entries())
            })
            if (!response.ok) {
                handleResponseError(response)
                return;
            }

            if (!chatId) {
                const newChatId = response.headers.get('x-chat-id');
                if (newChatId) {
                    onChatCreated?.(newChatId);
                }
            }
        },
        onFinish: async (message) => {
            console.log('✅ Stream finished:', {
                messageLength: message.content.length,
                hasToolCalls: !!message.toolInvocations?.length
            })
            setErrorState(null);
            setAttachedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        },
        onError: (error) => {
            console.error('❌ Stream error:', error)
            handleChatError(error)
        }
    })

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

    // Handle form submission with input validation
    const handleSubmit = useCallback(
        async (e?: React.FormEvent<HTMLFormElement>) => {
            console.log('🔄 Starting submit process')
            if (e) {
                e.preventDefault()
                e.stopPropagation()
            }

            try {
                if (attachedFile) {
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

                    // Clear file immediately
                    const fileToSubmit = attachedFile
                    setAttachedFile(null)
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                    }

                    // Use append to send message and file content
                    await append({
                        content: message,
                        role: 'user',
                        createdAt: new Date(),
                    }, {
                        options: {
                            body: {
                                fileContent: sanitizedContent,
                                fileName: fileToSubmit.name
                            }
                        }
                    })
                } else {
                    const trimmedInput = input.trim()
                    if (!trimmedInput) return
                    await append({
                        content: trimmedInput,
                        role: 'user',
                        createdAt: new Date()
                    })
                }
            } catch (error) {
                console.error('❌ Submit error:', error)
                setErrorState(new Error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
            }
        },
        [append, attachedFile]
    )

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setAttachedFile(file)
            onFileSelect?.(file)
        }
    }

    const handleRemoveFile = () => {
        setAttachedFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

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

            {errorState ? (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-4 text-center"
                >
                    <p className="text-red-500 mb-2">
                    An error occurred. Please try again. {errorState.message}
                    </p>
                    <Button
                        onClick={handleRetry}
                        disabled={isLoading}
                        variant="secondary"
                        size="sm"
                    >
                        Retry
                    </Button>
                </motion.div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className="p-4 m-auto w-full max-w-[800px]"
                >
                    {attachedFile && (
                        <div className="-mb-5">
                            <FilePreview file={attachedFile} onRemove={handleRemoveFile} />
                        </div>
                    )}
                    <div className="flex space-x-2">
                        <div className="relative flex-grow">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={handleTextareaChange}
                                placeholder={placeholderText}
                                className="relative flex w-full min-h-[80px] max-h-[200px] bg-bg rounded-3xl px-4 py-3 text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSubmit()
                                    }
                                }}
                                disabled={isInputDisabled}
                            />
                            <div className="absolute right-2 bottom-2 flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    accept=".csv,.txt,.json"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isLoading || !!attachedFile}
                                >
                                    <Paperclip className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isLoading || (!input.trim() && !attachedFile)}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            )}
        </div>
    )
}

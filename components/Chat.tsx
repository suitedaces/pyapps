'use client'

import { useChat } from 'ai/react'
import { Message } from 'ai'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Code, Loader2, Send } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import modelsList from '@/lib/models.json'
import { useRouter } from 'next/navigation'
import { LLMModelConfig } from '@/lib/types'
import { useLocalStorage } from 'usehooks-ts'
import { Message as AIMessage } from '@/components/core/message'

interface ChatProps {
    chatId?: string | null
    initialMessages?: Message[]
    onChatCreated?: (chatId: string) => void
}

// Core chat component that handles message streaming, UI rendering, and error states
export function Chat({ chatId = null, initialMessages = [], onChatCreated }: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [errorState, setErrorState] = useState<Error | null>(null)

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
        error,
        setMessages,
    } = useChat({
        api: chatId ? `/api/conversations/${chatId}/stream` : '/api/conversations/stream',
        id: chatId ?? undefined,
        initialMessages,
        streamProtocol: 'data',
        body: {
            model: currentModel,
            config: languageModel,
        },
        onResponse: (response) => {
            if (!response.ok) {
                handleResponseError(response)
            }
        },
        // Extract chat ID from initial message and clean up content
        onFinish: async (message) => {
            if (message.content && !chatId) {
                const match = message.content.match(/__CHAT_ID__(.+)__/)
                if (match) {
                    const newChatId = match[1]
                    const finalContent = message.content.replace(/__CHAT_ID__(.+)__/, '')

                    setMessages(prev => prev.map(msg =>
                        msg.id === message.id ? { ...msg, content: finalContent } : msg
                    ))

                    onChatCreated?.(newChatId)
                }
            }
            setErrorState(null)
        },
        onError: (error) => handleChatError(error)
    })

    // Combine and deduplicate messages from different sources
    const messages = useMemo(() => {
        const allMessages = [...initialMessages, ...aiMessages]
        return Array.from(new Map(allMessages.map(msg => [msg.id, msg])).values())
    }, [initialMessages, aiMessages])

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
            if (e) {
                e.preventDefault()
                e.stopPropagation()
            }

            const trimmedInput = input.trim()
            if (!trimmedInput) return

            try {
                await originalHandleSubmit(undefined as any)
            } catch (error) {
                setErrorState(new Error('Failed to send message. Please try again.'))
            }
        },
        [originalHandleSubmit, input]
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

    console.log('🎨 Rendering Chat Component:', {
        messageCount: messages.length,
        isLoading,
        hasError: !!error || !!errorState
    })

    return (
        <div className="flex flex-col h-full relative dark:border-darkBorder border-2 border-border bg-white dark:bg-darkBg text-text dark:text-darkText">
            <ScrollArea className="flex-grow p-4 space-y-4 w-full h-full max-w-[800px] m-auto">
                <AnimatePresence initial={false}>
                    {messages.map((message, index) => (
                        <AIMessage
                            key={message.id}
                            {...message}
                            isLastMessage={index === messages.length - 1}
                        />
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
                    <div className="flex space-x-2">
                        <div className="relative flex-grow">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={handleTextareaChange}
                                placeholder="Type your message..."
                                className="relative flex w-full min-h-[80px] max-h-[200px] bg-bg rounded-3xl px-4 py-3 text-sm resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSubmit()
                                    }
                                }}
                                disabled={isLoading}
                            />
                            <Button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="absolute right-2 bottom-2"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    )
}

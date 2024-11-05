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
import { generateUUID } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface ChatProps {
    chatId?: string | null
    initialMessages?: Message[]
    onChatCreated?: (chatId: string) => void
}

export function Chat({ chatId = null, initialMessages = [], onChatCreated }: ChatProps) {
    const router = useRouter()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [currentChatId, setCurrentChatId] = useState<string | null>(chatId)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const queryClient = useQueryClient()

    // Get model configuration from localStorage
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20240620',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Create a new chat when needed
    const createNewChat = useCallback(async () => {
        try {
            setIsCreatingChat(true)
            const newChatId = generateUUID()

            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ chatId: newChatId })
            })

            if (!response.ok) throw new Error('Failed to create chat')

            setCurrentChatId(newChatId)
            onChatCreated?.(newChatId)
            return newChatId
        } catch (error) {
            console.error('Error creating chat:', error)
            return null
        } finally {
            setIsCreatingChat(false)
        }
    }, [onChatCreated])

    // Fetch messages using React Query
    const { data: chatMessages, isLoading: isLoadingMessages } = useQuery({
        queryKey: ['chat-messages', chatId],
        queryFn: async () => {
            if (!chatId) return []
            const response = await fetch(`/api/conversations/${chatId}/messages`)
            if (!response.ok) throw new Error('Failed to fetch messages')
            const data = await response.json()
            return data.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role || (msg.user_message ? 'user' : 'assistant'),
                content: msg.user_message || msg.assistant_message,
                createdAt: new Date(msg.created_at),
                toolCalls: msg.tool_calls,
                toolResults: msg.tool_results
            }))
        },
        enabled: !!chatId,
        staleTime: 1000 * 60, // Consider messages fresh for 1 minute
    })

    // Combine messages for chat
    const allMessages = useMemo(() => {
        if (!chatMessages) return initialMessages
        return chatMessages
    }, [chatMessages, initialMessages])

    const {
        messages,
        input,
        handleInputChange,
        handleSubmit: originalHandleSubmit,
        isLoading,
        error,
        reload,
        setMessages
    } = useChat({
        api: chatId ? `/api/conversations/${chatId}/stream` : undefined,
        id: chatId ?? undefined,
        initialMessages: allMessages,
        body: {
            model: currentModel,
            config: languageModel,
        },
        onResponse: (response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
        },
        onFinish: async (message) => {
            console.log('Chat Finished:', message)
        },
        onError: (error) => {
            console.error('Chat Error:', error)
        }
    })

    // Simplified form submission handler
    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            e.stopPropagation()

            const trimmedInput = input.trim()
            if (!trimmedInput) return

            try {
                if (!chatId) {
                    const newChatId = await createNewChat()
                    if (!newChatId) {
                        throw new Error('Failed to create chat')
                    }
                    onChatCreated?.(newChatId)
                    return
                }

                // Single state update for user message
                const userMessage = {
                    id: generateUUID(),
                    role: 'user' as const,
                    content: trimmedInput,
                    createdAt: new Date()
                }

                setMessages(prev => [...prev, userMessage])

                // Call submit without event object
                await originalHandleSubmit(undefined as any)
            } catch (error) {
                console.error('Error handling submit:', error)
                setMessages(prev => [
                    ...prev,
                    {
                        id: generateUUID(),
                        role: 'system' as const,
                        content: 'Failed to send message. Please try again.',
                        createdAt: new Date()
                    }
                ])
            }
        },
        [chatId, createNewChat, originalHandleSubmit, onChatCreated, input, setMessages]
    )

    // Update scroll effect to be more efficient
    useEffect(() => {
        if (messages.length > 0) {
            const timeoutId = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
            return () => clearTimeout(timeoutId)
        }
    }, [messages])

    // Textarea handler
    const handleTextareaChange = useCallback((
        e: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
        handleInputChange(e)
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [handleInputChange])

    // Show loading state
    if (isLoadingMessages) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        )
    }

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

            {/* Add onSubmit directly to form and prevent default */}
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSubmit(e)
                }}
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
                                    handleSubmit(e as any)
                                }
                            }}
                        />
                        <Button
                            type="button" // Change to button type
                            onClick={(e) => handleSubmit(e as any)}
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

            {error && (
                <div className="p-4 text-center">
                    <p className="text-red-500">An error occurred. Please try again.</p>
                    <Button onClick={() => reload()} className="mt-2">
                        Retry
                    </Button>
                </div>
            )}
        </div>
    )
}

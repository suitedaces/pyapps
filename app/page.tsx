'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useState, useEffect, useRef } from 'react'
import { Chat } from '@/components/Chat'
import LoginPage from '@/components/LoginPage'
import {
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Sidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { generateUUID } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query'
import { TypingText } from '@/components/core/typing-text'
import { Logo } from '@/components/core/Logo'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { ResizableHandle } from '@/components/ui/resizable'
import { Message } from 'ai'
import { useChat } from 'ai/react'

import { useLocalStorage } from 'usehooks-ts'
import { LLMModelConfig } from '@/lib/types'
import modelsList from '@/lib/models.json'
import { useSandbox } from '@/contexts/SandboxContext'

// Add CustomHandle component
const CustomHandle = ({ ...props }) => (
    <ResizableHandle {...props} withHandle className="relative">
        <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
            <div className="h-8 w-1 rounded-full bg-black" />
        </div>
    </ResizableHandle>
)

export default function Home() {
    const router = useRouter()
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const { session, isLoading: isAuthLoading } = useAuth()
    const [showTypingText, setShowTypingText] = useState(true)
    const { sandbox, updateCode, updateEnvVars } = useSandbox()

    // Add new state for right panel
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [initialMessages, setInitialMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)

    const resizableGroupRef = useRef<any>(null)

    // Fetch chats for sidebar
    const { data: sidebarChats, isLoading: isLoadingChats } = useQuery({
        queryKey: ['chats'],
        queryFn: async () => {
            if (!session) return []
            const response = await fetch('/api/conversations?page=1&limit=10')
            if (!response.ok) throw new Error('Failed to fetch chats')
            const data = await response.json()
            return data.chats
        },
        enabled: !!session,
    })

    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20240620',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Add fetchMessages function
    const fetchMessages = useCallback(async (chatId: string) => {
        try {
            setLoading(true)
            const response = await fetch(`/api/conversations/${chatId}/messages`)
            if (!response.ok) throw new Error('Failed to fetch messages')
            const data = await response.json()

            // Transform messages to the format expected by the AI SDK
            const messages: Message[] = data.messages.flatMap((msg: any) => {
                const messages: Message[] = []
                if (msg.user_message) {
                    messages.push({
                        id: `${msg.id}-user`,
                        role: 'user',
                        content: msg.user_message,
                    })
                }
                if (msg.assistant_message) {
                    messages.push({
                        id: `${msg.id}-assistant`,
                        role: 'assistant',
                        content: msg.assistant_message,
                    })
                }
                return messages
            })

            setInitialMessages(messages)
        } catch (error) {
            console.error('Error fetching messages:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    // Handle chat creation callback
    const handleChatCreated = useCallback((chatId: string) => {
        setShowTypingText(false)
        setCurrentChatId(chatId)
        fetchMessages(chatId)
    }, [fetchMessages])

    // Update handleChatSelect to fetch messages and hide typing text
    const handleChatSelect = useCallback((chatId: string) => {
        setShowTypingText(false)
        setCurrentChatId(chatId)
        fetchMessages(chatId)
    }, [fetchMessages])

    // Handle new chat creation
    const handleNewChat = useCallback(async () => {
        setIsCreatingChat(true)
        try {
            const newChatId = generateUUID()
            handleChatCreated(newChatId)
        } finally {
            setIsCreatingChat(false)
        }
    }, [handleChatCreated])

    const handleChatSubmit = useCallback(() => {
        setShowTypingText(false)
    }, [])

    const {
        messages,
        isLoading: chatLoading,
        setMessages
    } = useChat({
        api: currentChatId ? `/api/conversations/${currentChatId}/stream` : '/api/conversations/stream',
        id: currentChatId ?? undefined,
        initialMessages,
        body: {
            model: currentModel,
            config: languageModel,
            experimental_streamData: true
        },
        maxSteps: 10,
        onResponse: (response) => {
            if (!response.ok) {
                return
            }
        },
        onFinish: async (message) => {
            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .filter(invocation =>
                        invocation.toolName === 'create_streamlit_app' &&
                        invocation.state === 'result'
                    )
                    .pop()

                if (streamlitCall?.state === 'result') {
                    const code = streamlitCall.result
                    if (code) {
                        setGeneratedCode(code)
                        await updateCode(code)
                    }
                }
            }

            if (message.content.trim()) {
                const assistantMessage = {
                    id: Date.now().toString(),
                    role: 'assistant' as const,
                    content: message.content,
                    createdAt: new Date(),
                    toolInvocations: message.toolInvocations
                }

                setMessages(prev => [...prev, assistantMessage])
            }
        },
        onError: (error) => {
            setIsGeneratingCode(false)
        }
    })

    useEffect(() => {
        if (chatLoading) {
            setIsGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [chatLoading])

    // Update the useEffect that handles tool invocations
    useEffect(() => {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.toolInvocations?.length) {
            const streamlitCall = lastMessage.toolInvocations
                .find(invocation =>
                    invocation.toolName === 'create_streamlit_app' &&
                    invocation.state === 'result'
                )

            if (streamlitCall?.state === 'result' && streamlitCall.result) {
                setGeneratedCode(streamlitCall.result)
                setIsGeneratingCode(false)
            }
        }
    }, [messages])

    const toggleRightContent = useCallback(() => {
        setShowTypingText(false)
        setIsRightContentVisible((prev) => !prev)
        
        if (isRightContentVisible) {
            setTimeout(() => {
                setShowTypingText(true)
            }, 200)
        }
        
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [isRightContentVisible])

    // Update URL without navigation using replaceState
    useEffect(() => {
        if (currentChatId) {
            window.history.replaceState(
                null,
                '',
                `/chat/${currentChatId}`
            )
        } else {
            window.history.replaceState(
                null,
                '',
                '/'
            )
        }
    }, [currentChatId])

    // Handle rerun through sandbox context
    const handleRerun = useCallback(async () => {
        if (!sandbox.code) return
        await updateCode(sandbox.code)
    }, [sandbox.code, updateCode])

    // Handle env vars through sandbox context
    const handleEnvVarsChange = useCallback(async (envVars: Record<string, string>) => {
        if (!sandbox.id) return
        await updateEnvVars(envVars)
    }, [sandbox.id, updateEnvVars])

    if (isAuthLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>
    }

    if (!session) {
        return <LoginPage />
    }

    return (
        <SidebarProvider>
            <div className="relative flex h-screen overflow-hidden">
                <Sidebar
                    onChatSelect={handleChatSelect}
                    currentChatId={currentChatId}
                    chats={sidebarChats || []}
                    collapsed={sidebarCollapsed}
                    onCollapsedChange={setSidebarCollapsed}
                />
                <div className="flex-1 flex flex-col bg-white min-w-0">
                    {sidebarCollapsed && (
                        <div
                            className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200"
                            style={{
                                left: '4rem',
                                right: 0
                            }}
                        >
                            <div className="px-4">
                                <Logo inverted collapsed={false} />
                            </div>
                        </div>
                    )}
                    <main className={cn(
                        "flex-grow flex px-2 pr-9 flex-col lg:flex-row overflow-hidden justify-center relative",
                        "h-screen pt-14"
                    )}>
                        {showTypingText && !currentChatId && (
                            <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
                                <TypingText
                                    text="From Data to App, in seconds."
                                    className="text-black font-semibold text-4xl whitespace-nowrap"
                                    show={showTypingText}
                                />
                            </div>
                        )}
                        <ResizablePanelGroup
                            direction="horizontal"
                            ref={resizableGroupRef}
                        >
                            <ResizablePanel defaultSize={65} minSize={45}>
                                <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                                    <Chat
                                        chatId={currentChatId}
                                        initialMessages={initialMessages}
                                        onChatCreated={handleChatCreated}
                                        onChatSubmit={handleChatSubmit}
                                    />
                                </div>
                            </ResizablePanel>

                            {isRightContentVisible && (
                                <CustomHandle className="bg-gradient-to-r from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 transition-colors" />
                            )}

                            {isRightContentVisible && (
                                <ResizablePanel
                                    minSize={40}
                                    className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden rounded-xl bg-white h-[calc(100vh-4rem)] border border-gray-200"
                                >
                                    <StreamlitPreview
                                        onRerun={handleRerun}
                                        onEnvVarsChange={handleEnvVarsChange}
                                    />
                                </ResizablePanel>
                            )}

                            <Button
                                onClick={toggleRightContent}
                                className={cn(
                                    "absolute top-2 right-4 z-10",
                                    "bg-black hover:bg-black/90",
                                    "text-white",
                                    "border border-transparent",
                                    "transition-all duration-200 ease-in-out",
                                    "shadow-lg hover:shadow-xl",
                                    "rounded-lg z-30"
                                )}
                                size="icon"
                            >
                                {isRightContentVisible ? (
                                    <ChevronRight className="h-4 w-4" />
                                ) : (
                                    <ChevronLeft className="h-4 w-4" />
                                )}
                            </Button>
                        </ResizablePanelGroup>
                    </main>
                </div>
            </div>
        </SidebarProvider>
    )
}

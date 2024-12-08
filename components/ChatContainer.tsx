'use client'

import { Chat } from '@/components/Chat'
import { Logo } from '@/components/core/Logo'
import LoginPage from '@/components/LoginPage'
import { PreviewPanel } from '@/components/PreviewPanel'
import AppSidebar from './Sidebar'
import { StreamlitPreviewRef } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import modelsList from '@/lib/models.json'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { createVersion } from '@/lib/supabase'
import { AppVersion, LLMModelConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Message } from 'ai'
import { useChat } from 'ai/react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { VersionSelector } from '../components/VersionSelector'
import { TypingText } from './core/typing-text'

interface ChatContainerProps {
    initialChat?: any
    isNewChat?: boolean
    isInChatPage?: boolean
}

export default function ChatContainer({ initialChat, isNewChat = false, isInChatPage = false }: ChatContainerProps) {
    const supabase = createClientComponentClient()
    const router = useRouter()
    const { session, isLoading } = useAuth()
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const { killSandbox, updateSandbox } = useSandboxStore()

    // All state declarations first
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [currentChatId, setCurrentChatId] = useState<string | null>(initialChat?.id || null)
    const [initialMessages, setInitialMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)
    const [showTypingText, setShowTypingText] = useState(true)
    const [activeTab, setActiveTab] = useState('preview')
    const [currentApp, setCurrentApp] = useState<{ id: string | null }>({ id: null })
    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [showCodeView, setShowCodeView] = useState(false)
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [sandboxErrors, setSandboxErrors] = useState<Array<{ message: string }>>([])
    const [isLoadingSandbox, setIsLoadingSandbox] = useState(false)
    const [sidebarChats, setSidebarChats] = useState<any[]>([])
    const [isCreatingVersion, setIsCreatingVersion] = useState(false)
    const [isCreatingChat, setIsCreatingChat] = useState(false)

    // All refs
    const hasNavigated = useRef(false)
    const isVersionSwitching = useRef(false)
    const versionSelectorRef = useRef<{ refreshVersions: () => void } | null>(null)
    const resizableGroupRef = useRef<any>(null)
    const isExecutingRef = useRef(false)

    // Model configuration
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20241022',
    })
    const currentModel = modelsList.models.find(model => model.id === languageModel.model)

    // Streamlit app management
    const updateStreamlitApp = useCallback(
        async (code: string, forceExecute = false) => {
            if (!code) {
                setStreamlitUrl(null)
                setIsGeneratingCode(false)
                return null
            }

            if (isExecutingRef.current) {
                console.log('⚠️ Already executing, skipping...')
                return null
            }

            isExecutingRef.current = true
            setIsLoadingSandbox(true)

            try {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const url = await updateSandbox(code, forceExecute)
                        if (url) {
                            setStreamlitUrl(url)
                            return url
                        }
                    } catch (error) {
                        if (attempt === 3) throw error
                        await new Promise(resolve => setTimeout(resolve, attempt * 1000))
                    }
                }
                return null
            } catch (error) {
                console.error('❌ All attempts to update sandbox failed:', error)
                return null
            } finally {
                isExecutingRef.current = false
                setIsLoadingSandbox(false)
                setIsGeneratingCode(false)
            }
        },
        [updateSandbox]
    )

    // Chat handling with AI SDK
    const {
        messages,
        isLoading: chatLoading,
        setMessages,
    } = useChat({
        api: currentChatId
            ? `/api/conversations/${currentChatId}/stream`
            : '/api/conversations/stream',
        id: currentChatId ?? undefined,
        initialMessages,
        body: {
            model: currentModel,
            config: languageModel,
            experimental_streamData: true,
        },
        maxSteps: 10,
        onResponse: (response) => {
            if (!response.ok) return
        },
        onFinish: async (message) => {
            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .filter(invocation => invocation.toolName === 'create_streamlit_app' &&
                        invocation.state === 'result')
                    .pop()

                if (streamlitCall?.state === 'result') {
                    const code = streamlitCall.result
                    if (code && session?.user?.id) {
                        try {
                            setIsCreatingVersion(true)
                            setGeneratedCode(code)
                            await updateStreamlitApp(code)

                            const { data: chat } = await supabase
                                .from('chats')
                                .select('app_id')
                                .eq('id', currentChatId)
                                .single()

                            let appId = chat?.app_id

                            if (!appId) {
                                const { data: app, error: appError } = await supabase
                                    .from('apps')
                                    .insert({
                                        user_id: session.user.id,
                                        name: messages[0].content.slice(0, 50) + '...',
                                        description: 'Streamlit app created from chat',
                                        is_public: false,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                        created_by: session.user.id,
                                    })
                                    .select()
                                    .single()

                                if (appError) throw appError
                                appId = app.id

                                await supabase
                                    .from('chats')
                                    .update({ app_id: appId })
                                    .eq('id', currentChatId)
                            }

                            await createVersion(appId, code)
                            setCurrentApp({ id: appId })

                            if (versionSelectorRef.current) {
                                await versionSelectorRef.current.refreshVersions()
                            }
                        } catch (error) {
                            console.error('Failed to handle version creation:', error)
                        } finally {
                            setIsCreatingVersion(false)
                        }
                    }
                }
            }

            if (message.content.trim()) {
                const assistantMessage = {
                    id: Date.now().toString(),
                    role: 'assistant' as const,
                    content: message.content,
                    createdAt: new Date(),
                    toolInvocations: message.toolInvocations,
                }

                setMessages(prev => [...prev, assistantMessage])
            }
        },
        onError: () => {
            setIsGeneratingCode(false)
        },
    })

    // Event handlers
    const handleRefresh = useCallback(async () => {
        if (sandboxId && session?.user?.id) {
            try {
                setIsGeneratingCode(true)
                await updateStreamlitApp(generatedCode, true)
            } catch (error) {
                console.error('Error refreshing app:', error)
            } finally {
                setIsGeneratingCode(false)
            }
        }
    }, [sandboxId, session?.user?.id, generatedCode, updateStreamlitApp])

    const handleCodeViewToggle = useCallback(() => {
        setShowCodeView(prev => !prev)
    }, [])

    const handleChatSelect = useCallback((chatId: string) => {
        router.push(`/chat/${chatId}`)
    }, [router])

    const handleChatSubmit = useCallback(() => {
        setShowTypingText(false)
    }, [])

    const handleNewChat = useCallback(() => {
        setStreamlitUrl(null)
        setGeneratedCode('')
        setCurrentChatId(null)
        router.push('/')
    }, [router])

    const handleChatFinish = useCallback(() => {
        if (versionSelectorRef.current) {
            versionSelectorRef.current.refreshVersions()
        }
    }, [])

    const handleChatCreated = useCallback((chatId: string) => {
        if (isNewChat) {
            // First navigate
            router.replace(`/chat/${chatId}`);
            return; // Let the chat/[id] page handle initialization
        }

        // Only handle state updates if not navigating
        setShowTypingText(false);
        setCurrentChatId(chatId);

        // Refresh the chat list
        const loadChats = async () => {
            try {
                const response = await fetch('/api/conversations')
                if (!response.ok) throw new Error('Failed to fetch chats')
                const data = await response.json()
                setSidebarChats(data.chats)
            } catch (error) {
                console.error('Error fetching chats:', error)
            }
        }
        loadChats()
    }, [router, isNewChat])

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible(prev => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [])

    const handleVersionChange = useCallback(async (version: AppVersion) => {
        if (!version.code) return

        isVersionSwitching.current = true
        setIsGeneratingCode(true)

        try {
            setGeneratedCode(version.code)
            await updateStreamlitApp(version.code, true)
        } catch (error) {
            setSandboxErrors(prev => [...prev, {
                message: error instanceof Error ? error.message : 'Error updating version'
            }])
        } finally {
            setIsGeneratingCode(false)
            isVersionSwitching.current = false
        }
    }, [updateStreamlitApp])

    // Effects
    useEffect(() => {
        if (isNewChat && currentChatId && !hasNavigated.current) {
            hasNavigated.current = true
            router.replace(`/chat/${currentChatId}`)
        }
    }, [isNewChat, currentChatId, router])

    useEffect(() => {
        if (chatLoading) {
            setIsGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [chatLoading])

    useEffect(() => {
        const loadChats = async () => {
            try {
                const response = await fetch('/api/conversations')
                if (!response.ok) throw new Error('Failed to fetch chats')
                const data = await response.json()
                setSidebarChats(data.chats)
            } catch (error) {
                console.error('Error fetching chats:', error)
            }
        }

        if (session?.user?.id) {
            loadChats()
        }
    }, [session?.user?.id])

    useEffect(() => {
        const initializeChat = async () => {
            if (!currentChatId) return

            try {
                setLoading(true)
                setIsGeneratingCode(true)

                // Fetch messages
                const messagesResponse = await fetch(`/api/conversations/${currentChatId}/messages`)
                if (!messagesResponse.ok) throw new Error('Failed to fetch messages')
                const data = await messagesResponse.json()

                // Process messages and look for tool results
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
                setMessages(messages)

                // Find the latest Streamlit code from tool results
                const streamlitCode = data.messages
                    .filter((msg: any) => msg.tool_results && Array.isArray(msg.tool_results))
                    .map((msg: any) => {
                        const toolResult = msg.tool_results[0]
                        if (toolResult && toolResult.name === 'create_streamlit_app') {
                            return toolResult.result
                        }
                        return null
                    })
                    .filter(Boolean)
                    .pop()

                if (streamlitCode) {
                    setGeneratedCode(streamlitCode)
                    await updateStreamlitApp(streamlitCode, true)
                    setIsRightContentVisible(true)
                }

            } catch (error) {
                console.error('Error initializing chat:', error)
            } finally {
                setLoading(false)
                setIsGeneratingCode(false)
            }
        }

        initializeChat()
    }, [currentChatId, updateStreamlitApp, setMessages])

    // Cleanup effect
    useEffect(() => {
        return () => {
            killSandbox()
            isExecutingRef.current = false
        }
    }, [killSandbox])

    // Update messages when last message contains tool invocations
    useEffect(() => {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.toolInvocations?.length) {
            const streamlitCall = lastMessage.toolInvocations.find(
                invocation => invocation.toolName === 'create_streamlit_app' &&
                    invocation.state === 'result'
            )

            if (streamlitCall?.state === 'result') {
                setGeneratedCode(streamlitCall.result)
                setIsGeneratingCode(false)
                updateStreamlitApp(streamlitCall.result)
            }
        }
    }, [messages, updateStreamlitApp])

    useEffect(() => {
        if (generatedCode) {
            setIsRightContentVisible(true)
        }
    }, [generatedCode])

    // Loading states
    if (isLoading) {
        return <div>Loading...</div>
    }

    if (!session) {
        return <LoginPage />
    }

    const CustomHandle = ({ ...props }) => (
        <ResizableHandle {...props} withHandle className="relative bg-transparent">
            <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
                <div className="h-8 w-1 rounded-full bg-black dark:bg-white" />
            </div>
        </ResizableHandle>
    )

    return (
        <div className="bg-white dark:bg-dark-app relative flex h-screen overflow-hidden">
            <div className='absolute top-0 left-0 w-full h-full'>
                <div className="godrays top-0 left-0 w-full min-h-[30vh] relative z-5">
                    <div className="godrays-overlay dark:mix-blend-darken z-10" />
                </div>
            </div>
            <AppSidebar
                onChatSelect={handleChatSelect}
                currentChatId={currentChatId}
                chats={sidebarChats}
                onNewChat={handleNewChat}
                isCreatingChat={isCreatingChat}
            />
            <div className="flex-1 flex flex-col bg-white dark:bg-dark-app min-w-0">
                {sidebarCollapsed && (
                    <div
                        className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200"
                        style={{
                            left: '4rem',
                            right: 0,
                        }}
                    >
                    </div>
                )}
                <main
                    className={cn(
                        'flex-grow flex px-2 pr-9 flex-col lg:flex-row overflow-hidden justify-center relative',
                        'h-screen pt-14'
                    )}
                >
                    <ResizablePanelGroup
                        direction="horizontal"
                        ref={resizableGroupRef}
                    >
                        <ResizablePanel defaultSize={40} minSize={30}>
                            <div className="w-full relative flex flex-col h-[calc(100vh-4rem)]">
                                {!isInChatPage && showTypingText && (
                                    <TypingText
                                        className='text-black dark:text-dark-text font-bold text-3xl'
                                        text='From Data to Apps, in seconds'
                                        speed={30}
                                        show={true}
                                    />
                                )}
                                <div className="max-w-[800px] mx-auto w-full h-full">
                                    <Chat
                                        chatId={currentChatId}
                                        initialMessages={initialMessages}
                                        onChatCreated={handleChatCreated}
                                        onChatSubmit={handleChatSubmit}
                                        onChatFinish={handleChatFinish}
                                        onUpdateStreamlit={updateStreamlitApp}
                                        setActiveTab={setActiveTab}
                                        setIsRightContentVisible={setIsRightContentVisible}
                                        onCodeClick={() => {
                                            setActiveTab('code')
                                            setIsRightContentVisible(true)
                                        }}
                                        isInChatPage={isInChatPage}
                                    />
                                </div>
                            </div>
                        </ResizablePanel>

                        {isRightContentVisible && (
                            <>
                                <CustomHandle className="bg-gradient-to-r from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 dark:from-white/10 dark:to-white/5 dark:hover:from-white/20 dark:hover:to-white/10 transition-colors" />
                                <ResizablePanel
                                    defaultSize={60}
                                    minSize={40}
                                    className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden rounded-xl bg-white dark:bg-dark-app h-[calc(100vh-4rem)] border border-gray-200 dark:border-dark-border"
                                >
                                    <PreviewPanel
                                        streamlitUrl={streamlitUrl}
                                        generatedCode={generatedCode}
                                        isGeneratingCode={isGeneratingCode}
                                        isLoadingSandbox={isLoadingSandbox}
                                        showCodeView={showCodeView}
                                        onRefresh={handleRefresh}
                                        onCodeViewToggle={handleCodeViewToggle}
                                    />
                                </ResizablePanel>
                            </>
                        )}
                    </ResizablePanelGroup>
                    <div className="absolute top-2 right-4 z-30 flex justify-between items-center gap-4">
                        {currentApp?.id && (
                            <VersionSelector
                                appId={currentApp.id}
                                onVersionChange={handleVersionChange}
                                ref={versionSelectorRef}
                            />
                        )}

                        <Button
                            onClick={toggleRightContent}
                            className={cn(
                                'bg-black dark:bg-dark-background dark:border-neutral-400 hover:bg-black/90',
                                'text-white',
                                'border border-transparent dark:border-dark-border',
                                'transition-all duration-200 ease-in-out',
                                'shadow-lg hover:shadow-xl',
                                'rounded-lg'
                            )}
                            size="icon"
                        >
                            {isRightContentVisible ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <ChevronLeft className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </main>
            </div>
        </div>
    )
}

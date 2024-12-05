'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

import { Chat } from '@/components/Chat'
import LoginPage from '@/components/LoginPage'
import { PreviewPanel } from '@/components/PreviewPanel'
import { Button } from '@/components/ui/button'
import { useChat } from 'ai/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Message } from 'ai'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'

import { Sidebar } from '@/components/Sidebar'

import { Logo } from '@/components/core/Logo'
import { VersionSelector } from '@/components/VersionSelector'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import modelsList from '@/lib/models.json'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { createVersion } from '@/lib/supabase'
import { AppVersion, LLMModelConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useLocalStorage } from 'usehooks-ts'

interface ChatPageClientProps {
    initialChat: any
}

async function getOrCreateApp(chatId: string | null, userId: string) {
    if (!chatId) throw new Error('No chat ID provided')

    const supabase = createClientComponentClient()

    // Check if chat already has an app
    const { data: chat } = await supabase
        .from('chats')
        .select('app_id')
        .eq('id', chatId)
        .single()

    if (chat?.app_id) return chat.app_id

    // Create new app if none exists
    const { data: app, error: appError } = await supabase
        .from('apps')
        .insert({
            user_id: userId,
            name: 'New App',
            description: 'App created from chat',
            is_public: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: userId,
        })
        .select()
        .single()

    if (appError) throw appError

    // Link chat to app
    await supabase.from('chats').update({ app_id: app.id }).eq('id', chatId)

    return app.id
}

export default function ChatPageClient({ initialChat }: ChatPageClientProps) {
    const supabase = createClientComponentClient()

    // UI state management
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [currentChatId, setCurrentChatId] = useState<string | null>(
        initialChat.id
    )
    const [initialMessages, setInitialMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } =
        useSidebar()
    const [showTypingText, setShowTypingText] = useState(true)
    const [activeTab, setActiveTab] = useState('preview')

    // Code and preview state
    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [showCodeView, setShowCodeView] = useState(false)

    const handleRefresh = async () => {
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
    }

    const handleCodeViewToggle = () => {
        setShowCodeView(!showCodeView)
    }

    // Version switching stuff
    const isVersionSwitching = useRef(false)
    const versionSelectorRef = useRef<{
        refreshVersions: () => void
    } | null>(null)

    // Model config
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20241022',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Auth and version state
    const { session, isLoading } = useAuth()
    const [isCreatingVersion, setIsCreatingVersion] = useState(false)

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
            if (!response.ok) {
                return
            }
        },
        onFinish: async (message) => {
            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .filter(
                        (invocation) =>
                            invocation.toolName === 'create_streamlit_app' &&
                            invocation.state === 'result'
                    )
                    .pop()

                if (streamlitCall?.state === 'result') {
                    const code = streamlitCall.result
                    if (code) {
                        setIsCreatingVersion(true)
                        setGeneratedCode(code)
                        await updateStreamlitApp(code)

                        if (session?.user?.id) {
                            try {
                                let appId = await getOrCreateApp(
                                    currentChatId,
                                    session.user.id
                                )
                                const versionData = await createVersion(
                                    appId,
                                    code
                                )
                                setCurrentApp({ id: appId })

                                if (versionSelectorRef.current) {
                                    await versionSelectorRef.current.refreshVersions()
                                }
                            } catch (error) {
                                setIsCreatingVersion(false)
                            }
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
                    toolInvocations: message.toolInvocations || [],
                }

                setMessages((prev) => [...prev, assistantMessage])
            }
        },
        onError: (error) => {
            setIsGeneratingCode(false)
        },
    })

    useEffect(() => {
        if (chatLoading) {
            setIsGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [chatLoading])

    //  sandbox state
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [sandboxErrors, setSandboxErrors] = useState<
        Array<{ message: string }>
    >([])

    // Sandbox store hooks
    const { killSandbox, updateSandbox } = useSandboxStore()


    // Add a loading state ref to prevent multiple executions
    const isExecutingRef = useRef(false)

    // Add new state for sandbox loading
    const [isLoadingSandbox, setIsLoadingSandbox] = useState(false)

    // Modify updateStreamlitApp
    const updateStreamlitApp = useCallback(
        async (code: string, forceExecute = false) => {
            if (!code) {
                setStreamlitUrl(null)
                setIsGeneratingCode(false)
                return null
            }

            // Prevent multiple simultaneous executions
            if (isExecutingRef.current) {
                console.log('⚠️ Already executing, skipping...')
                return null
            }

            isExecutingRef.current = true
            setIsLoadingSandbox(true)  // Show loading state while sandbox executes

            try {
                // Try up to 3 times
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        console.log(` Attempt ${attempt} to update sandbox...`)
                        const url = await updateSandbox(code, forceExecute)
                        if (url) {
                            console.log('✅ Sandbox updated successfully')
                            setStreamlitUrl(url)
                            return url
                        }
                    } catch (error) {
                        console.error(`❌ Attempt ${attempt} failed:`, error)
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
                setIsLoadingSandbox(false)  // Hide loading state when done
                setIsGeneratingCode(false)
            }
        },
        [updateSandbox]
    )

    useEffect(() => {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.toolInvocations?.length) {
            const streamlitCall = lastMessage.toolInvocations.find(
                (invocation) =>
                    invocation.toolName === 'create_streamlit_app' &&
                    invocation.state === 'result'
            )

            if (streamlitCall?.state === 'result') {
                setGeneratedCode(streamlitCall.result)
                setIsGeneratingCode(false)
                updateStreamlitApp(streamlitCall.result)
            }
        }
    }, [messages, updateStreamlitApp])

    const resizableGroupRef = useRef<any>(null)
    const [sidebarChats, setSidebarChats] = useState<any[]>([])

    const router = useRouter()
    const { id } = useParams() as { id: string }

    // First, define loadAppAndVersion
    const loadAppAndVersion = useCallback(async () => {
        if (!currentChatId) return

        try {
            const { data: chat } = await supabase
                .from('chats')
                .select('app_id')
                .eq('id', currentChatId)
                .single()

            if (chat?.app_id) {
                setCurrentApp({ id: chat.app_id })
                const { data: versions } = await supabase
                    .from('versions')
                    .select('*')
                    .eq('app_id', chat.app_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                if (versions?.code) {
                    setGeneratedCode(versions.code)
                    await updateStreamlitApp(versions.code, true)
                    setIsRightContentVisible(true)
                }
            }
        } catch (error) {
            console.error('Error loading app:', error)
        }
    }, [currentChatId, supabase, updateStreamlitApp])

    // Then define loadChat
    const loadChat = useCallback(async (chatId: string) => {
        console.log('🔄 Loading chat:', chatId)
        setIsGeneratingCode(true)
        try {
            const response = await fetch(`/api/conversations/${chatId}/messages`)
            if (!response.ok) throw new Error('Failed to fetch messages')
            const data = await response.json()
            console.log('📥 Received messages:', data.messages)

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

            console.log('✨ Transformed messages:', messages)
            setInitialMessages(messages)
            await loadAppAndVersion()
        } catch (error) {
            console.error('❌ Error loading chat:', error)
        } finally {
            setIsGeneratingCode(false)
        }
    }, [loadAppAndVersion, setInitialMessages, setIsGeneratingCode])

    // Finally use it in useEffect
    useEffect(() => {
        if (id && id === currentChatId) {
            setCurrentChatId(id)
            loadChat(id)
        }
    }, [id, currentChatId, loadChat])

    // Update chat selection handler
    const handleChatSelect = useCallback((chatId: string) => {
        router.push(`/chat/${chatId}`)
    }, [router])

    const fetchAndSetChats = useCallback(async () => {
        try {
            const response = await fetch('/api/conversations?page=1&limit=10')
            if (response.ok) {
                const data = await response.json()
                setSidebarChats(data.chats)
            }
        } catch (error) {
            console.error('Error fetching chats:', error)
        }
    }, [])

    useEffect(() => {
        if (session) {
            fetchAndSetChats()
        }
    }, [session, fetchAndSetChats])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const chatId = params.get('chat')
        if (chatId) {
            setCurrentChatId(chatId)
        }
    }, [])

    const handleNewChat = useCallback(async () => {
        setCurrentChatId(null)
        router.replace('/', { scroll: false })
        return Promise.resolve()
    }, [router])

    // Handle chat creation callback
    const handleChatCreated = useCallback(
        (chatId: string) => {
            setShowTypingText(false)
            setCurrentChatId(chatId)
            router.replace(`/chat/${chatId}`)
        },
        [router]
    )

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible((prev) => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [])

    const [currentApp, setCurrentApp] = useState<{ id: string } | null>(null)

    // Add debug log for page load
    useEffect(() => {
        if (generatedCode && sandboxId) {
            updateStreamlitApp(generatedCode, true)
        }
    }, [generatedCode, sandboxId, updateStreamlitApp])

    // Update version change handler
    const handleVersionChange = async (version: AppVersion) => {
        if (!version.code) return

        isVersionSwitching.current = true
        setIsGeneratingCode(true)

        try {
            setGeneratedCode(version.code)
            await updateStreamlitApp(version.code, true)
        } catch (error) {
            setSandboxErrors((prev) => [...prev, {
                message: error instanceof Error ? error.message : 'Error updating version'
            }])
        } finally {
            setIsGeneratingCode(false)
            isVersionSwitching.current = false
        }
    }

    // Simplify cleanup
    useEffect(() => {
        return () => {
            killSandbox()
        }
    }, [killSandbox])

    // Modify fetchAppId to handle errors better
    const fetchAppId = useCallback(async () => {
        if (!currentChatId) return

        try {
            console.log('🔍 Fetching app for chat:', currentChatId)
            const { data: chat } = await supabase
                .from('chats')
                .select('app_id')
                .eq('id', currentChatId)
                .single()

            if (chat?.app_id) {
                console.log('📱 Found app:', chat.app_id)
                setCurrentApp({ id: chat.app_id })

                const { data: versions } = await supabase
                    .from('versions')
                    .select('*')
                    .eq('app_id', chat.app_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                if (versions?.code) {
                    console.log('📦 Found latest version, executing code...')
                    setGeneratedCode(versions.code)
                    await updateStreamlitApp(versions.code, true)
                    setIsRightContentVisible(true)
                } else {
                    console.log('⚠️ No code found in versions')
                }
            } else {
                console.log('ℹ️ No app found for chat')
            }
        } catch (error) {
            console.error('❌ Error fetching app:', error)
        }
    }, [currentChatId, supabase, updateStreamlitApp])

    useEffect(() => {
        console.log('🔄 Dependencies changed - currentChatId:', currentChatId);
        if (currentChatId) {
            fetchAppId();
        }
    }, [currentChatId, fetchAppId]);

    const handleChatFinish = useCallback(() => {
        if (versionSelectorRef.current) {
            versionSelectorRef.current.refreshVersions()
        }
    }, [])

    const CustomHandle = ({ ...props }) => (
        <ResizableHandle {...props} withHandle className="relative">
            <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
                <div className="h-8 w-1 rounded-full bg-black" />
            </div>
        </ResizableHandle>
    )

    const handleChatSubmit = useCallback(() => {
        setShowTypingText(false)
    }, [])

    // Add this function before the useEffect hooks
    const fetchToolResults = useCallback(async () => {
        if (!currentChatId) return

        try {
            const response = await fetch(
                `/api/conversations/${currentChatId}/messages`
            )
            if (!response.ok) throw new Error('Failed to fetch messages')

            const data = await response.json()

            // Find the last Streamlit code generation result
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
                // Force execute the code when loading an existing chat
                await updateStreamlitApp(streamlitCode, true)
            }
        } catch (error) {
            console.error('Error fetching tool results:', error)
        }
    }, [currentChatId, updateStreamlitApp])

    // The existing useEffect will now work with the defined function
    useEffect(() => {
        const initializeChatAndSandbox = async () => {
            if (currentChatId) {
                await fetchToolResults()
            }
        }

        initializeChatAndSandbox()
    }, [currentChatId, fetchToolResults])

    useEffect(() => {
        if (generatedCode) {
            setIsRightContentVisible(true)
        }
    }, [generatedCode])

    useEffect(() => {
        console.log('Current state:', {
            currentChatId,
            generatedCode: !!generatedCode,
            streamlitUrl,
            isRightContentVisible
        })
    }, [currentChatId, generatedCode, streamlitUrl, isRightContentVisible])

    // Add cleanup on unmount
    useEffect(() => {
        return () => {
            isExecutingRef.current = false
        }
    }, [])

    // Add this useEffect to sync messages when initialMessages changes
    useEffect(() => {
        if (initialMessages.length > 0) {
            console.log('🔄 Syncing messages:', initialMessages)
            setMessages(initialMessages)
        }
    }, [initialMessages, setMessages])

    if (isLoading) {
        return <div>Loading...</div>
    }

    if (!session) {
        return <LoginPage />
    }

    return (
        <div className="relative flex h-screen overflow-hidden">
            <Sidebar
                onChatSelect={handleChatSelect}
                currentChatId={currentChatId}
                chats={sidebarChats}
                collapsed={sidebarCollapsed}
                onCollapsedChange={setSidebarCollapsed}
            />
            <div
                className={cn(
                    'flex-1 flex flex-col bg-white min-w-0 transition-all duration-200',
                    'relative'
                )}
            >
                {sidebarCollapsed && (
                    <div
                        className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200"
                        style={{
                            left: '4rem',
                            right: 0,
                        }}
                    >
                        <div className="px-4">
                            <Logo inverted collapsed={false} />
                        </div>
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
                            <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                                <div className="max-w-[800px] mx-auto w-full h-full">
                                    <Chat
                                        chatId={currentChatId}
                                        initialMessages={initialMessages}
                                        onChatCreated={handleChatCreated}
                                        onChatSubmit={handleChatSubmit}
                                        onChatFinish={handleChatFinish}
                                        onUpdateStreamlit={updateStreamlitApp}
                                        setActiveTab={setActiveTab}
                                        setIsRightContentVisible={
                                            setIsRightContentVisible
                                        }
                                        onCodeClick={() => {
                                            setActiveTab('code')
                                            setIsRightContentVisible(true)
                                        }}
                                    />
                                </div>
                            </div>
                        </ResizablePanel>

                        {isRightContentVisible && (
                            <>
                                <CustomHandle className="bg-gradient-to-r from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 transition-colors" />
                                <ResizablePanel
                                    defaultSize={60}
                                    minSize={40}
                                    className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden rounded-xl bg-white h-[calc(100vh-4rem)] border border-gray-200"
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
                            <div className="bg-white p-2 rounded-lg shadow-md">
                                <VersionSelector
                                    appId={currentApp.id}
                                    onVersionChange={handleVersionChange}
                                    ref={versionSelectorRef}
                                />
                            </div>
                        )}
                        <Button
                            onClick={toggleRightContent}
                            className={cn(
                                'bg-black hover:bg-black/90',
                                'text-white',
                                'border border-transparent',
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

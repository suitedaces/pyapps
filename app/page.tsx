'use client'

import { Chat } from '@/components/Chat'
import { Logo } from '@/components/core/Logo'
import { TypingText } from '@/components/core/typing-text'
import LoginPage from '@/components/LoginPage'
import { PreviewPanel } from '@/components/PreviewPanel'
import { Sidebar } from '@/components/Sidebar'
import { StreamlitPreviewRef } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { cn, generateUUID } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Message } from 'ai'
import { useChat } from 'ai/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { VersionSelector } from '@/components/VersionSelector'
import modelsList from '@/lib/models.json'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { createVersion } from '@/lib/supabase'
import { AppVersion, LLMModelConfig } from '@/lib/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useLocalStorage } from 'usehooks-ts'

// Add CustomHandle component
const CustomHandle = ({ ...props }) => (
    <ResizableHandle {...props} withHandle className="relative">
        <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
            <div className="h-8 w-1 rounded-full bg-black" />
        </div>
    </ResizableHandle>
)

export default function Home() {
    const supabase = createClientComponentClient()

    // Chat and UI state
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const [loading, setLoading] = useState(false)
    const [initialMessages, setInitialMessages] = useState<Message[]>([])
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } =
        useSidebar()
    const { session, isLoading: isAuthLoading } = useAuth()
    const [showTypingText, setShowTypingText] = useState(true)

    // Right panel state
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [isCreatingVersion, setIsCreatingVersion] = useState(false)

    // Sandbox state
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [sandboxErrors, setSandboxErrors] = useState<
        Array<{ message: string }>
    >([])
    const resizableGroupRef = useRef<any>(null)

    // App state
    const [currentApp, setCurrentApp] = useState<{ id: string } | null>(null)

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
        model: 'claude-3-5-sonnet-20241022',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Add fetchMessages function
    const fetchMessages = useCallback(async (chatId: string) => {
        try {
            setLoading(true)
            const response = await fetch(
                `/api/conversations/${chatId}/messages`
            )
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
    const handleChatCreated = useCallback(
        (chatId: string) => {
            setShowTypingText(false)
            setCurrentChatId(chatId)
            fetchMessages(chatId)
        },
        [fetchMessages]
    )

    // Update handleChatSelect to fetch messages and hide typing text
    const handleChatSelect = useCallback(
        (chatId: string) => {
            setShowTypingText(false)
            setCurrentChatId(chatId)
            fetchMessages(chatId)
        },
        [fetchMessages]
    )

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
                                const { data: app, error: appError } =
                                    await supabase
                                        .from('apps')
                                        .insert({
                                            user_id: session.user.id,
                                            name:
                                                messages[0].content.slice(
                                                    0,
                                                    50
                                                ) + '...',
                                            description:
                                                'Streamlit app created from chat',
                                            is_public: false,
                                            created_at:
                                                new Date().toISOString(),
                                            updated_at:
                                                new Date().toISOString(),
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

                            const versionData = await createVersion(appId, code)
                            setCurrentApp({ id: appId })

                            if (versionSelectorRef.current) {
                                await versionSelectorRef.current.refreshVersions()
                            }
                        } catch (error) {
                            console.error(
                                'Failed to handle version creation:',
                                error
                            )
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

    // Sandbox state management
    const { initializeSandbox, killSandbox, updateSandbox } = useSandboxStore()

    useEffect(() => {
        initializeSandbox()

        return () => {
            killSandbox()
        }
    }, [initializeSandbox, killSandbox])

    // Add streamlit update function
    const updateStreamlitApp = useCallback(
        async (code: string, forceExecute: boolean = false) => {
            const url = await updateSandbox(code, forceExecute)
            if (url) {
                setStreamlitUrl(url)
                setIsGeneratingCode(false)
            }
        },
        [updateSandbox]
    )

    // Initialize sandbox on mount
    useEffect(() => {
        initializeSandbox()
    }, [initializeSandbox])

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible((prev) => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [])

    // Update URL without navigation using replaceState
    useEffect(() => {
        if (currentChatId) {
            window.history.replaceState(null, '', `/chat/${currentChatId}`)
        } else {
            window.history.replaceState(null, '', '/')
        }
    }, [currentChatId])

    // Realtime tool result handling from messages
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

    // Fetch tool results from messages when ChatID changes!
    useEffect(() => {
        async function fetchToolResults() {
            if (!currentChatId) return

            try {
                const response = await fetch(
                    `/api/conversations/${currentChatId}/messages`
                )
                if (!response.ok) {
                    throw new Error('Failed to fetch messages')
                }

                const data = await response.json()

                const streamlitCode = data.messages
                    .filter(
                        (msg: any) =>
                            msg.tool_results && Array.isArray(msg.tool_results)
                    )
                    .map((msg: any) => {
                        const toolResult = msg.tool_results[0]
                        if (
                            toolResult &&
                            toolResult.name === 'create_streamlit_app'
                        ) {
                            return toolResult.result
                        }
                        return null
                    })
                    .filter(Boolean)
                    .pop()

                if (streamlitCode) {
                    setGeneratedCode(streamlitCode)
                    if (!isGeneratingCode) {
                        await updateStreamlitApp(streamlitCode)
                    }
                }
            } catch (error) {
                console.error('Error fetching tool results:', error)
            }
        }

        fetchToolResults()
    }, [currentChatId, updateStreamlitApp, isGeneratingCode])

    // Add version change handler
    const isVersionSwitching = useRef(false)
    const versionSelectorRef = useRef<{
        refreshVersions: () => void
    } | null>(null)

    const handleVersionChange = async (version: AppVersion) => {
        if (!version.code) {
            console.error('No code found in version:', version)
            return
        }

        isVersionSwitching.current = true
        setIsGeneratingCode(true)

        try {
            console.log('🔄 Version switch initiated:', {
                versionId: version.id,
                appId: currentApp?.id,
                versionNumber: version.version_number,
            })

            setGeneratedCode(version.code)
            await updateStreamlitApp(version.code, true)
        } catch (error) {
            console.error('❌ Failed to update app with version:', error)
        } finally {
            setTimeout(() => {
                setIsGeneratingCode(false)
                isVersionSwitching.current = false
            }, 500)
        }
    }

    // Add useEffect to fetch app ID when chat loads
    const fetchAppId = useCallback(async () => {
        if (!currentChatId) return

        try {
            const { data: chat } = await supabase
                .from('chats')
                .select('app_id')
                .eq('id', currentChatId)
                .single()

            if (chat?.app_id) {
                setCurrentApp({ id: chat.app_id })

                // Fetch latest version code
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
                }
            }
        } catch (error) {
            console.error('Error fetching app:', error)
        }
    }, [currentChatId, supabase, updateStreamlitApp])

    // Add this useEffect to trigger fetchAppId
    useEffect(() => {
        if (session?.user?.id && currentChatId) {
            fetchAppId()
        }
    }, [session?.user?.id, currentChatId, fetchAppId])

    const handleChatFinish = useCallback(() => {
        console.log('🔄 Chat finished, refreshing version selector')
        if (versionSelectorRef.current) {
            versionSelectorRef.current.refreshVersions()
        }
    }, [])

    const [showCodeView, setShowCodeView] = useState(false)

    const handleRefresh = useCallback(() => {
        if (streamlitPreviewRef.current) {
            streamlitPreviewRef.current.refreshIframe()
        }
        setIsGeneratingCode(true)
        setTimeout(() => setIsGeneratingCode(false), 500)
    }, [])

    const handleCodeViewToggle = useCallback(() => {
        setShowCodeView((prev) => !prev)
    }, [])

    const streamlitPreviewRef = useRef<StreamlitPreviewRef>(null)

    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                Loading...
            </div>
        )
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
                            <ResizablePanel
                                defaultSize={40}
                                minSize={30}
                                className="relative"
                            >
                                {showTypingText && (
                                    <div className="absolute w-full top-1/3 transform z-50">
                                        <TypingText
                                            text="From Data to App, in seconds."
                                            className="text-black font-semibold text-4xl whitespace-nowrap"
                                            show={showTypingText}
                                        />
                                    </div>
                                )}
                                <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                                    <Chat
                                        chatId={currentChatId}
                                        initialMessages={initialMessages}
                                        onChatCreated={handleChatCreated}
                                        onChatSubmit={handleChatSubmit}
                                        onChatFinish={handleChatFinish}
                                    />
                                </div>
                            </ResizablePanel>

                            {isRightContentVisible && (
                                <>
                                    <CustomHandle className="bg-gradient-to-l from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 transition-colors" />
                                    <ResizablePanel
                                        defaultSize={60}
                                        minSize={45}
                                        className="w-full lg:w-1/2 p-2 flex flex-col overflow-hidden rounded-xl bg-white h-[calc(100vh-4rem)] border border-gray-200"
                                    >
                                        <PreviewPanel
                                            streamlitUrl={streamlitUrl}
                                            generatedCode={generatedCode}
                                            isGeneratingCode={isGeneratingCode}
                                            showCodeView={showCodeView}
                                            onRefresh={handleRefresh}
                                            onCodeViewToggle={
                                                handleCodeViewToggle
                                            }
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
        </SidebarProvider>
    )
}

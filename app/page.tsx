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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CodeView } from '@/components/CodeView'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { ResizableHandle } from '@/components/ui/resizable'
import { Message } from 'ai'
import { useChat } from 'ai/react'

import { useLocalStorage } from 'usehooks-ts'
import { LLMModelConfig } from '@/lib/types'
import modelsList from '@/lib/models.json'
import { VersionSelector } from '@/components/VersionSelector'
import { AppVersion } from '@/lib/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createVersion } from '@/lib/supabase'

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
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const { session, isLoading: isAuthLoading } = useAuth()
    const [showTypingText, setShowTypingText] = useState(true)

    // Add new state for right panel
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [sandboxErrors, setSandboxErrors] = useState<Array<{ message: string }>>([])
    const resizableGroupRef = useRef<any>(null)

    const [initialMessages, setInitialMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)

    // Add state for app and version
    const [currentApp, setCurrentApp] = useState<{ id: string } | null>(null)
    const [isCreatingVersion, setIsCreatingVersion] = useState(false)

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
            console.log('🎯 onFinish triggered:', {
                hasToolInvocations: !!message.toolInvocations?.length,
                messageContent: message.content.slice(0, 100)
            })

            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .filter(invocation =>
                        invocation.toolName === 'create_streamlit_app' &&
                        invocation.state === 'result'
                    )
                    .pop()

                console.log('🔍 Streamlit call:', {
                    found: !!streamlitCall,
                    state: streamlitCall?.state,
                    hasResult: !!streamlitCall
                })

                if (streamlitCall?.state === 'result') {
                    const code = streamlitCall.result
                    console.log('💻 Generated code:', {
                        hasCode: !!code,
                        codeLength: code?.length,
                        hasSession: !!session,
                        userId: session?.user?.id
                    })

                    if (code && session?.user?.id) {
                        try {
                            setIsCreatingVersion(true)
                            setGeneratedCode(code)
                            console.log('🔄 Updating Streamlit app...')
                            await updateStreamlitApp(code)

                            // Check if chat already has an app
                            console.log('🔍 Checking for existing app...')
                            const { data: chat } = await supabase
                                .from('chats')
                                .select('app_id')
                                .eq('id', currentChatId)
                                .single()

                            console.log('📱 Chat data:', {
                                chatId: currentChatId,
                                existingAppId: chat?.app_id
                            })

                            let appId = chat?.app_id

                            if (!appId) {
                                console.log('🆕 Creating new app...')
                                // Create new app if none exists
                                const { data: app, error: appError } = await supabase
                                    .from('apps')
                                    .insert({
                                        user_id: session.user.id,
                                        name: messages[0].content.slice(0, 50) + '...',
                                        description: 'Streamlit app created from chat',
                                        is_public: false,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                        created_by: session.user.id
                                    })
                                    .select()
                                    .single()

                                if (appError) {
                                    console.error('❌ App creation failed:', appError)
                                    throw appError
                                }
                                appId = app.id
                                console.log('✅ App created:', { appId })

                                // Link chat to app
                                const { error: chatError } = await supabase
                                    .from('chats')
                                    .update({ app_id: appId })
                                    .eq('id', currentChatId)

                                if (chatError) {
                                    console.error('❌ Chat update failed:', chatError)
                                    throw chatError
                                }
                                console.log('🔗 Chat linked to app')
                            }

                            // Create new version
                            console.log('📝 Creating new version...')
                            const versionData = await createVersion(appId, code)
                            console.log('✅ Version created:', versionData)

                            setCurrentApp({ id: appId })
                            console.log('🔄 Current app updated:', { appId })

                        } catch (error) {
                            console.error('❌ Failed to handle version creation:', error)
                        } finally {
                            setIsCreatingVersion(false)
                        }
                    } else {
                        console.error('❌ Missing code or session:', {
                            hasCode: !!code,
                            hasSession: !!session
                        })
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

    // Add sandbox initialization logic
    const initializeSandbox = useCallback(async () => {
        try {
            const response = await fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`)
            }

            const data = await response.json()
            setSandboxId(data.sandboxId)
        } catch (error) {
            console.error('Error initializing sandbox:', error)
            setSandboxErrors(prev => [...prev, {
                message: error instanceof Error ? error.message : 'Error initializing sandbox'
            }])
        }
    }, [])

    // Add streamlit update function
    const updateStreamlitApp = useCallback(async (code: string) => {
        if (!code || !sandboxId) return

        try {
            const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`)
            }

            const data = await response.json()
            if (data.url) {
                setStreamlitUrl(data.url)
                setIsGeneratingCode(false)
            }
        } catch (error) {
            console.error('Error in updateStreamlitApp:', error)
            setSandboxErrors(prev => [...prev, {
                message: error instanceof Error ? error.message : 'Error updating Streamlit app'
            }])
            setIsGeneratingCode(false)
        }
    }, [sandboxId])

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

    // Realtime tool result handling from messages
    useEffect(() => {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.toolInvocations?.length) {
            const streamlitCall = lastMessage.toolInvocations
                .find(invocation =>
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
            if (!currentChatId) return;

            try {
                const response = await fetch(`/api/conversations/${currentChatId}/messages`);
                if (!response.ok) {
                    throw new Error('Failed to fetch messages');
                }

                const data = await response.json();

                const streamlitCode = data.messages
                    .filter((msg: any) => msg.tool_results && Array.isArray(msg.tool_results))
                    .map((msg: any) => {
                        const toolResult = msg.tool_results[0];
                        if (toolResult && toolResult.name === 'create_streamlit_app') {
                            return toolResult.result;
                        }
                        return null;
                    })
                    .filter(Boolean)
                    .pop();

                if (streamlitCode) {
                    setGeneratedCode(streamlitCode);
                    if (!isGeneratingCode) {
                        await updateStreamlitApp(streamlitCode);
                    }
                }
            } catch (error) {
                console.error('Error fetching tool results:', error);
            }
        }

        fetchToolResults();
    }, [currentChatId, updateStreamlitApp, isGeneratingCode]);

    // Add version change handler
    const handleVersionChange = async (version: AppVersion) => {
        if (version.code) {
            setGeneratedCode(version.code)
            await updateStreamlitApp(version.code)
        }
    }

    // Add useEffect to fetch app ID when chat loads
    useEffect(() => {
        async function fetchAppId() {
            if (!currentChatId) return

            const { data: chat } = await supabase
                .from('chats')
                .select('app_id')
                .eq('id', currentChatId)
                .single()

            if (chat?.app_id) {
                setCurrentApp({ id: chat.app_id })
            }
        }
        fetchAppId()
    }, [currentChatId])

    useEffect(() => {
        console.log('👁️ Current app state changed:', {
            hasApp: !!currentApp,
            appId: currentApp?.id
        })
    }, [currentApp])

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
                        {showTypingText && (
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
                                    <Tabs
                                        defaultValue="code"
                                        className="flex-grow flex flex-col h-full"
                                    >
                                        <TabsList className="grid w-full grid-cols-2 bg-gray-100 rounded-lg overflow-hidden p-1">
                                            <TabsTrigger
                                                value="preview"
                                                className="data-[state=active]:bg-black data-[state=active]:text-white text-gray-700 hover:text-black transition-colors rounded"
                                            >
                                                App
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="code"
                                                className="data-[state=active]:bg-black data-[state=active]:text-white text-gray-700 hover:text-black transition-colors rounded"
                                            >
                                                Code
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent
                                            value="preview"
                                            className="flex-grow overflow-hidden mt-4"
                                        >
                                            <StreamlitPreview
                                                url={streamlitUrl}
                                                isGeneratingCode={isGeneratingCode}
                                            />
                                        </TabsContent>

                                        <TabsContent
                                            value="code"
                                            className="flex-grow overflow-hidden mt-4"
                                        >
                                            <div className="flex justify-between items-center mb-4">
                                                {currentApp && (
                                                    <VersionSelector
                                                        appId={currentApp.id}
                                                        onVersionChange={handleVersionChange}
                                                    />
                                                )}
                                            </div>
                                            <CodeView
                                                code={generatedCode}
                                                isGeneratingCode={isGeneratingCode || isCreatingVersion}
                                            />
                                        </TabsContent>
                                    </Tabs>
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

'use client'

import Chat from '@/components/Chat'
import { PreviewPanel } from '@/components/PreviewPanel'
import { AuthPrompt } from '@/components/ui/auth-prompt'
import { Button } from '@/components/ui/button'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import modelsList from '@/lib/models.json'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { AppVersion, LLMModelConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useChat } from 'ai/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { VersionSelector } from '../components/VersionSelector'
import { TypingText } from './core/typing-text'
import LoadingAnimation from './LoadingAnimation'
import AppSidebar from './Sidebar'

interface ChatContainerProps {
    initialChat?: any
    initialMessages?: any[]
    initialVersion?: AppVersion | AppVersion[] | null
    initialFiles?: Array<{
        id: string
        file_name: string
        file_type: string
        analysis: string | null
        created_at: string
    }>
    isNewChat?: boolean
    isInChatPage?: boolean
    initialAppId?: string | null
    onChatDeleted?: () => void
}

interface StreamlitToolCall {
    toolCallId: string
    toolName: 'streamlitTool'
    args: {
        code: string
        requiredLibraries: string[]
        appName: string
        appDescription: string
    }
}

interface RightPanelState {
    isVisible: boolean
    view: 'code' | 'preview'
}

interface ChatState {
    status: 'initial' | 'typing' | 'creating' | 'active'
    hasMessages: boolean
}

export default function ChatContainer({
    initialMessages = [],
    initialVersion = null,
    isNewChat = false,
    isInChatPage = false,
    initialAppId = null,
}: ChatContainerProps) {
    const router = useRouter()
    const { session, isLoading, shouldShowAuthPrompt } =
        useAuth()
    const { collapsed: sidebarCollapsed } = useSidebar()
    const {
        streamlitUrl,
        generatedCode,
        updateSandbox,
        killSandbox,
        setGeneratingCode,
        isGeneratingCode,
        isLoadingSandbox,
        setStreamlitUrl,
        setGeneratedCode,
        setIsLoadingSandbox,
    } = useSandboxStore()

    // Refs for preventing race conditions
    const abortControllerRef = useRef<AbortController | null>(null)
    const pendingFileLinkId = useRef<string | null>(null)
    const newChatIdRef = useRef<string | null>(null)
    const isVersionSwitching = useRef(false)
    const versionSelectorRef = useRef<{ refreshVersions: () => void } | null>(
        null
    )
    const resizableGroupRef = useRef<any>(null)
    const isExecutingRef = useRef(false)
    const hasInitialized = useRef(false)
    const streamlitPreviewRef = useRef<{ refreshIframe: () => void } | null>(
        null
    )
    const titleGeneratedRef = useRef<Set<string>>(new Set())

    // State management
    const [sidebarChats, setSidebarChats] = useState<any[]>([])
    const [currentChatId, setCurrentChatId] = useState<string | undefined>(
        undefined
    )
    const [rightPanel, setRightPanel] = useState<RightPanelState>({
        isVisible: false,
        view: 'preview',
    })
    const [chatState, setChatState] = useState<ChatState>({
        status: 'initial',
        hasMessages: initialMessages?.length > 0,
    })
    const [errorState, setErrorState] = useState<Error | null>(null)
    const [hasFirstMessage, setHasFirstMessage] = useState(false)
    const [currentAppId, setCurrentAppId] = useState<string | null>(
        initialAppId || null
    )
    const [chatTitles, setChatTitles] = useState<Record<string, string>>({})
    const [persistedFileIds, setPersistedFileIds] = useState<string[]>([])

    // Model configuration
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20241022',
    })
    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Add this state to track navigation
    const [isNavigating, setIsNavigating] = useState(false)
    const [versionKey, setVersionKey] = useState<number>(0)

    // Move updateChatState before handleChatCreated
    const updateChatState = useCallback((updates: Partial<ChatState>) => {
        setChatState((prev) => ({ ...prev, ...updates }))
    }, [])

    const {
        messages,
        isLoading: chatLoading,
        input,
        handleInputChange: originalHandleInputChange,
        handleSubmit: originalHandleSubmit,
        append,
        setMessages,
    } = useChat({
        api: '/api/chats/stream',
        id: currentChatId || undefined,
        initialMessages: initialMessages || [],
        body: {
            chatId: currentChatId,
            model: currentModel,
            config: languageModel,
            experimental_streamData: true,
            fileIds: persistedFileIds
        },
        onResponse: async (response) => {
            const newChatId = response.headers.get('x-chat-id')
            const newAppId = response.headers.get('x-app-id')
            if (newChatId && !currentChatId) {
                newChatIdRef.current = newChatId
            }
            if (newAppId && !currentAppId) {
                setCurrentAppId(newAppId)
            }

            // Remove file linking from here since it's handled by handleFileSelection
            if (pendingFileLinkId.current) {
                setPersistedFileIds([pendingFileLinkId.current])
                pendingFileLinkId.current = null
            }
        },
        onToolCall: async ({ toolCall }) => {
            console.log('🔧 onToolCall:', toolCall)

            const streamlitToolCall = toolCall as StreamlitToolCall
            if (streamlitToolCall.toolName === 'streamlitTool' && streamlitToolCall.args?.code) {
                React.startTransition(() => {
                    setRightPanel((prev) => ({
                        ...prev,
                        isVisible: true,
                    }))
                    setGeneratingCode(true)
                })
                
                // Update the app with code immediately
                console.log('🚀 Updating Streamlit app with code from toolCall')
                setGeneratedCode(streamlitToolCall.args.code)
                await updateStreamlitApp(streamlitToolCall.args.code, true)
            }
        },
        onFinish: async (message) => {
            console.log('✨ onFinish:', {
                message,
                toolInvocations: message.toolInvocations,
                messages: messages,
                content: message.content
            })

            try {
                if (!message.content || !newChatIdRef.current || currentChatId) {
                    return
                }

                const chatId = newChatIdRef.current
                newChatIdRef.current = null
                router.push(`/projects/${chatId}`)

                // const hasToolInvocations = message.toolInvocations && message.toolInvocations.length > 0

                const tasks = [
                    generateTitle(chatId),
                    // hasToolInvocations 
                    //     ? handleToolInvocations(message.toolInvocations as StreamlitToolCall[])
                    //     : Promise.resolve(),
                ]

                Promise.all(tasks).catch(console.error)
                
                return
            } catch (error) {
                console.error('Failed in onFinish:', error)
                setErrorState(error as Error)
            }
        },
    })

    // Improved Streamlit app management with retry logic
    const updateStreamlitApp = useCallback(
        async (code: string, forceExecute = false) => {
            if (!code) {
                setStreamlitUrl(null)
                setGeneratingCode(false)
                return null
            }

            if (isExecutingRef.current) {
                return null
            }

            isExecutingRef.current = true

            try {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const url = await updateSandbox(code, forceExecute)
                        if (url) {
                            setStreamlitUrl(url)
                            if (streamlitPreviewRef.current?.refreshIframe) {
                                await new Promise((resolve) =>
                                    setTimeout(resolve, 3000)
                                )
                                streamlitPreviewRef.current.refreshIframe()
                                setIsLoadingSandbox(false)
                            }
                            return url
                        }
                    } catch (error) {
                        if (attempt === 3) throw error
                        await new Promise((resolve) =>
                            setTimeout(resolve, attempt * 1000)
                        )
                    }
                }
                return null
            } catch (error) {
                console.error('Failed to update sandbox after retries:', error)
                setErrorState(error as Error)
                return null
            } finally {
                isExecutingRef.current = false
                setGeneratingCode(false)
            }
        },
        [
            updateSandbox,
            setStreamlitUrl,
            setGeneratingCode,
            setIsLoadingSandbox,
            currentChatId
        ]
    )

    const handleToolInvocations = useCallback(
        async (toolInvocations: StreamlitToolCall[]) => {
            console.log('🛠️ Processing tool invocations:', toolInvocations)

            // Just in case onToolCall didn't catch it
            const streamlitCall = toolInvocations.find(
                call => call.toolName === 'streamlitTool' && call.args?.code
            )

            if (streamlitCall?.args?.code && streamlitCall.args.code !== generatedCode) {
                console.log('🚀 Updating Streamlit app with code from toolInvocations')
                setGeneratedCode(streamlitCall.args.code)
                await updateStreamlitApp(streamlitCall.args.code, true)
            }
        },
        [setGeneratedCode, updateStreamlitApp, generatedCode]
    )

    // Improved file upload with abort controller
    const handleFileUpload = useCallback(
        async (file: File, fileId: string) => {
            try {
                // Clear UI states first
                if (isNewChat) {
                    pendingFileLinkId.current = fileId
                    updateChatState({ status: 'active' }) // This will clear typing text
                }

                // Set loading states
                setHasFirstMessage(true)

                // Now append the message
                await append(
                    {
                        content: `Create a Streamlit app to visualize this data.`,
                        role: 'user',
                        createdAt: new Date(),
                    },
                    {
                        body: {
                            chatId: currentChatId,
                            fileId: fileId,
                            fileName: file.name,
                        },
                    }
                )
            } catch (error) {
                console.error('Error processing file:', error)
                setErrorState(error as Error)
            }
        },
        [append, currentChatId, isNewChat, updateChatState]
    )

    // Add handleSubmit to wrap the originalHandleSubmit
    const handleSubmit = useCallback(
        async (
            e: React.FormEvent,
            message: string,
            file?: File,
            fileId?: string
        ) => {
            e.preventDefault()
            setHasFirstMessage(true)

            // Validate message content
            if (file && fileId) {
                // Handle file upload case
                await handleFileUpload(file, fileId)
            } else if (message.trim()) {
                // Handle normal message case
                await originalHandleSubmit(e, {
                    body: {
                        fileIds: persistedFileIds,
                    },
                })
            }

            updateChatState({ status: 'active' })
        },
        [originalHandleSubmit, handleFileUpload, persistedFileIds]
    )

    const handleInputChange = useCallback(
        (value: string) => {
            originalHandleInputChange({
                target: { value },
            } as React.ChangeEvent<HTMLTextAreaElement>)
        },
        [originalHandleInputChange]
    )

    const handleRefresh = useCallback(async () => {
        if (currentChatId && session?.user?.id) {
            try {
                setGeneratingCode(true)
                await updateStreamlitApp(generatedCode, true)
            } catch (error) {
                console.error('Error refreshing app:', error)
            } finally {
                setGeneratingCode(false)
            }
        }
    }, [
        currentChatId,
        session?.user?.id,
        generatedCode,
        updateStreamlitApp,
        setGeneratingCode,
    ])

    const handleCodeViewToggle = useCallback(() => {
        setRightPanel((prev) => ({
            ...prev,
            view: prev.view === 'code' ? 'preview' : 'code',
        }))
    }, [])

    const handleChatSelect = useCallback(
        async (chatId: string) => {
            try {
                // Check if chat exists before navigating
                const response = await fetch(`/api/chats/${chatId}`)
                if (!response.ok) {
                    // Chat was deleted, refresh the chats list
                    const chatsResponse = await fetch('/api/chats')
                    if (chatsResponse.ok) {
                        const data = await chatsResponse.json()
                        setSidebarChats(data.chats)
                    }
                    router.push('/')
                    return
                }

                router.push(`/projects/${chatId}`)
            } catch (error) {
                console.error('Error selecting chat:', error)
                router.push('/')
            }
        },
        [router]
    )

    const handleVersionChange = useCallback(
        async (version: AppVersion) => {
            if (!version.code) return

            isVersionSwitching.current = true
            setGeneratingCode(true)

            try {
                setGeneratedCode(version.code)
                // Wait for sandbox update to complete
                await updateStreamlitApp(version.code, true)
            } catch (error) {
                setErrorState(error as Error)
            } finally {
                setGeneratingCode(false)
                isVersionSwitching.current = false
            }
        },
        [updateStreamlitApp, setGeneratingCode, setGeneratedCode]
    )

    const toggleRightContent = useCallback(() => {
        setRightPanel((prev) => ({
            ...prev,
            isVisible: !prev.isVisible,
        }))
    }, [])

    useEffect(() => {
        const loadChats = async () => {
            if (!session?.user?.id) return
            try {
                const response = await fetch('/api/chats')
                if (!response.ok) throw new Error('Failed to fetch chats')
                const data = await response.json()
                setSidebarChats(data.chats)
            } catch (error) {
                console.error('Error fetching chats:', error)
            }
        }

        loadChats()
    }, [session?.user?.id])

    useEffect(() => {
        const initializeChat = async () => {
            if (!currentChatId || isVersionSwitching.current || hasInitialized.current) return
            
            hasInitialized.current = true

            try {
                // Handle initial version if available
                const versionData = Array.isArray(initialVersion) ? initialVersion[0] : initialVersion
                if (versionData?.code) {
                    setRightPanel((prev) => ({
                        ...prev,
                        isVisible: true,
                    }))
                    setGeneratingCode(true)
                    setGeneratedCode(versionData.code)
                    await updateStreamlitApp(versionData.code, true)
                }

                // Load and set messages
                if (!initialMessages?.length) {
                    const messagesResponse = await fetch(`/api/chats/messages?chatId=${currentChatId}`)
                    if (!messagesResponse.ok) throw new Error('Failed to fetch messages')
                    const data = await messagesResponse.json()
                    
                    if (data.messages?.length) {
                        // Convert messages to Vercel AI SDK format
                        const formattedMessages = data.messages.map((msg: any) => ({
                            id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                            role: msg.role,
                            content: msg.content,
                            data: msg.data,
                            ...(msg.toolInvocations && { toolInvocations: msg.toolInvocations })
                        }))
                        setMessages(formattedMessages)
                    }
                } else {
                    // Format initial messages if provided
                    const formattedMessages = initialMessages.map((msg: any) => ({
                        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                        role: msg.role,
                        content: msg.content,
                        data: msg.data,
                        ...(msg.toolInvocations && { toolInvocations: msg.toolInvocations })
                    }))
                    setMessages(formattedMessages)
                }
            } catch (error) {
                console.error('Error initializing chat:', error)
                setErrorState(error as Error)
            } finally {
                setGeneratingCode(false)
            }
        }

        initializeChat()
    }, [currentChatId])

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            if (currentChatId) {
                killSandbox().catch(console.error)
            }
            isExecutingRef.current = false
            setStreamlitUrl(null)
            setGeneratedCode('')
        }
    }, [currentChatId, killSandbox, setStreamlitUrl, setGeneratedCode])

    // Add useEffect to handle window-dependent logic
    useEffect(() => {
        // This will only run on the client side
        const pathname = window.location.pathname
        const chatId = pathname.startsWith('/projects/')
            ? pathname.split('/').pop()
            : undefined
        setCurrentChatId(chatId)
    }, [])
    // Title generation
    const generateTitle = useCallback(
        async (chatId: string) => {
            if (titleGeneratedRef.current.has(chatId)) {
                return null
            }

            try {
                const response = await fetch(`/api/chats/${chatId}/title`, {
                    method: 'POST',
                })

                if (!response.ok) throw new Error('Failed to generate title')

                const data = await response.json()

                if (data.title) {
                    setChatTitles((prev) => ({ ...prev, [chatId]: data.title }))
                    titleGeneratedRef.current.add(chatId)

                    // Refresh chats list
                    const chatsResponse = await fetch('/api/chats')
                    if (chatsResponse.ok) {
                        const data = await chatsResponse.json()
                        setSidebarChats(data.chats)
                    }
                }

                return data.title
            } catch (error) {
                console.error('Error generating title:', error)
                return null
            }
        },
        [setSidebarChats]
    )

    const handleFileSelection = useCallback(async (fileIds: string[]) => {
        setPersistedFileIds(fileIds)
        if (currentChatId) {
            try {
                // Single API call to update associations
                await fetch(`/api/chats/${currentChatId}/files`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileIds }),
                })
            } catch (error) {
                console.error('Error updating file associations:', error)
            }
        }
    }, [currentChatId])

    // Loading states
    if (isLoading) {
        return (
            <div className="relative h-screen w-full">
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0" />
                <LoadingAnimation message="Loading..." />
            </div>
        )
    }

    const CustomHandle = ({ ...props }) => (
        <ResizableHandle
            {...props}
            withHandle
            className="relative bg-transparent"
        >
            <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
                <div className="h-8 w-1 rounded-full bg-black dark:bg-white" />
            </div>
        </ResizableHandle>
    )

    return (
        <div className="bg-white dark:bg-dark-app relative flex h-screen overflow-hidden">
            {/* Add a simple fade transition during navigation */}
            {isNavigating && (
                <div className="absolute inset-0 bg-background/50 z-50 transition-opacity duration-200" />
            )}

            <div className="absolute top-0 left-0 w-full h-full">
                <div className="godrays top-0 left-0 w-full min-h-[30vh] relative z-5">
                    <div className="godrays-overlay dark:mix-blend-darken z-10" />
                </div>
            </div>
            <AppSidebar
                onChatSelect={handleChatSelect}
                currentChatId={currentChatId || null}
                chats={sidebarChats}
                isCreatingChat={false}
                chatTitles={chatTitles}
                onGenerateTitle={generateTitle}
                onChatDeleted={() => {
                    // Clear current chat state
                    setCurrentAppId(null)
                    setMessages([])
                    setGeneratedCode('')
                    setStreamlitUrl(null)

                    // Reset UI state
                    setRightPanel({
                        isVisible: false,
                        view: 'preview',
                    })

                    // Refresh chats list
                    fetch('/api/chats')
                        .then((response) => response.json())
                        .then((data) => setSidebarChats(data.chats))
                        .catch(console.error)
                    router.push('/')
                }}
            />
            <div className="flex-1 flex flex-col bg-white dark:bg-dark-app min-w-0">
                {sidebarCollapsed && (
                    <div
                        className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200"
                        style={{
                            left: '4rem',
                            right: 0,
                        }}
                    ></div>
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
                            <div
                                className={cn(
                                    'w-full relative flex flex-col',
                                    hasFirstMessage || isInChatPage
                                        ? 'h-[calc(100vh-4rem)]'
                                        : 'h-screen'
                                )}
                            >
                                {!isInChatPage &&
                                    chatState.status === 'initial' && (
                                        <TypingText
                                            className="text-black dark:text-dark-text font-bold text-3xl"
                                            text="From Data to Apps, in seconds"
                                            speed={30}
                                            show={true}
                                        />
                                    )}
                                <div className="max-w-[800px] mx-auto w-full h-full">
                                    <Chat
                                        messages={isNavigating ? [] : messages}
                                        isLoading={chatLoading || isNavigating}
                                        input={input}
                                        onInputChange={handleInputChange}
                                        onSubmit={handleSubmit}
                                        errorState={errorState}
                                        onErrorDismiss={() =>
                                            setErrorState(null)
                                        }
                                        onUpdateStreamlit={updateStreamlitApp}
                                        onCodeClick={() => {
                                            setRightPanel((prev) => ({
                                                ...prev,
                                                view: 'code',
                                            }))
                                        }}
                                        onTogglePanel={toggleRightContent}
                                        isInChatPage={
                                            isInChatPage || hasFirstMessage
                                        }
                                        selectedFileIds={persistedFileIds}
                                        onFileSelect={handleFileSelection}
                                        chatId={currentChatId}
                                    />
                                </div>
                            </div>
                        </ResizablePanel>

                        {rightPanel.isVisible && (
                            <>
                                <CustomHandle className="bg-gradient-to-r from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 dark:from-white/10 dark:to-white/5 dark:hover:from-white/20 dark:hover:to-white/10 transition-colors" />
                                <ResizablePanel
                                    defaultSize={60}
                                    minSize={40}
                                    className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden rounded-xl bg-white dark:bg-dark-app h-[calc(100vh-4rem)] border border-gray-200 dark:border-dark-border"
                                >
                                    <PreviewPanel
                                        ref={streamlitPreviewRef}
                                        appId={currentAppId || undefined}
                                        streamlitUrl={streamlitUrl}
                                        generatedCode={generatedCode}
                                        isLoadingSandbox={isLoadingSandbox}
                                        isGeneratingCode={isGeneratingCode}
                                        showCodeView={
                                            rightPanel.view === 'code'
                                        }
                                        onCodeViewToggle={handleCodeViewToggle}
                                        onRefresh={handleRefresh}
                                    />
                                </ResizablePanel>
                            </>
                        )}
                    </ResizablePanelGroup>
                    <div className="absolute top-2 right-4 z-30 flex justify-between items-center gap-4">
                        {currentAppId && (
                            <VersionSelector
                                key={`version-${versionKey}`}
                                appId={currentAppId}
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
                            {rightPanel.isVisible ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <ChevronLeft className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </main>
            </div>

            {shouldShowAuthPrompt && <AuthPrompt />}
        </div>
    )
}

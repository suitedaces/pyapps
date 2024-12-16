'use client'

import { Chat } from '@/components/Chat'
import LoginPage from '@/components/LoginPage'
import { PreviewPanel } from '@/components/PreviewPanel'
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
import { cn, formatDatabaseMessages } from '@/lib/utils'
import { useChat } from 'ai/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { VersionSelector } from '../components/VersionSelector'
import { TypingText } from './core/typing-text'
import AppSidebar from './Sidebar'
import { AuthPrompt } from '@/components/ui/auth-prompt'

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
}

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

interface StreamlitToolCall {
    toolName: string
    toolCallId: string
    state: 'call' | 'partial-call' | 'result'
    args?: {
        dataDescription?: string
        query: string
        fileDirectory?: string
    }
    result?: {
        code: string
        appName: string
        appDescription: string
    }
}

interface SandboxState {
    id: string | null
    status: 'idle' | 'generating' | 'loading' | 'error'
    errors: Array<{ message: string }>
    isCreatingVersion: boolean
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
    initialChat,
    initialMessages = [],
    initialVersion = null,
    isNewChat = false,
    isInChatPage = false,
    initialFiles = [],
    initialAppId = null,
}: ChatContainerProps) {
    const router = useRouter()
    const { session, isLoading, isPreviewMode, shouldShowAuthPrompt } = useAuth()
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
    const hasNavigated = useRef(false)
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
    const [currentChatId, setCurrentChatId] = useState<string | null>(
        initialChat?.id || null
    )
    const [rightPanel, setRightPanel] = useState<RightPanelState>({
        isVisible: false,
        view: 'preview',
    })
    const [chatState, setChatState] = useState<ChatState>({
        status: 'initial',
        hasMessages: initialMessages?.length > 0,
    })
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [isCreatingVersion, setIsCreatingVersion] = useState(false)
    const [errorState, setErrorState] = useState<Error | null>(null)
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        isUploading: false,
        progress: 0,
        error: null,
    })
    const [hasFirstMessage, setHasFirstMessage] = useState(false)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const [currentAppId, setCurrentAppId] = useState<string | null>(
        initialAppId || null
    )
    const [chatTitles, setChatTitles] = useState<Record<string, string>>({})

    // Model configuration
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20241022',
    })
    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Move updateChatState before handleChatCreated
    const updateChatState = useCallback((updates: Partial<ChatState>) => {
        setChatState((prev) => ({ ...prev, ...updates }))
    }, [])

    // Improved chat creation handler with race condition prevention
    const handleChatCreated = useCallback(
        (chatId: string) => {
            setCurrentChatId(chatId)
            updateChatState({
                status: 'active',
                hasMessages: true,
            })

            if (!hasNavigated.current && isNewChat) {
                hasNavigated.current = true
                router.replace(`/chat/${chatId}`)
            }

            // Refresh chat list with cleanup
            const controller = new AbortController()
            const loadChats = async () => {
                try {
                    const response = await fetch('/api/chats', {
                        signal: controller.signal,
                    })
                    if (!response.ok) throw new Error('Failed to fetch chats')
                    const data = await response.json()
                    setSidebarChats(data.chats)
                } catch (error) {
                    if (error instanceof Error && error.name !== 'AbortError') {
                        console.error('Error fetching chats:', error)
                    }
                }
            }
            loadChats()

            return () => controller.abort()
        },
        [router, isNewChat, updateChatState]
    )

    // Chat hook with improved error handling
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
        id: currentChatId ?? undefined,
        initialMessages: formatDatabaseMessages(initialMessages || []),
        body: {
            chatId: currentChatId,
            model: currentModel,
            config: languageModel,
            experimental_streamData: true,
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

            if (pendingFileLinkId.current && newChatId) {
                try {
                    await fetch('/api/chats/files', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: newChatId,
                            fileId: pendingFileLinkId.current,
                        }),
                    })
                    pendingFileLinkId.current = null
                } catch (error) {
                    console.error('Failed to link file:', error)
                    setErrorState(error as Error)
                }
            }
        },
        onToolCall: async ({ toolCall }) => {
            console.log('🔧 Tool Call Received:', toolCall) // Debug log

            const streamlitToolCall = toolCall as unknown as StreamlitToolCall
            if (streamlitToolCall.toolName === 'streamlitTool') {
                try {
                    React.startTransition(() => {
                        setRightPanel((prev) => ({
                            ...prev,
                            isVisible: true,
                        }))
                        setGeneratingCode(true)
                    })
                } catch (error) {
                    console.error('Failed to update sandbox:', error)
                    setErrorState(error as Error)
                } finally {
                    if (streamlitToolCall.state === 'result') {
                        console.log('✅ Finished Processing Tool Call') // Debug log
                        setGeneratingCode(false)
                    }
                }
            } else {
                console.log('⚠️ Unknown Tool Call:', streamlitToolCall.toolName) // Debug log
            }
        },
        onFinish: async (message) => {
            try {
                if (message.content && newChatIdRef.current) {
                    handleChatCreated(newChatIdRef.current)
                    newChatIdRef.current = null
                }

                if (message.toolInvocations?.length) {
                    const streamlitCall = message.toolInvocations.find(
                        (invocation) =>
                            invocation.toolName === 'streamlitTool' &&
                            invocation.state === 'result'
                    )

                    if (
                        streamlitCall?.state === 'result' &&
                        streamlitCall.result?.code
                    ) {
                        setIsCreatingVersion(true)
                        setGeneratedCode(streamlitCall.result.code)
                        await updateStreamlitApp(streamlitCall.result.code)

                        if (versionSelectorRef.current) {
                            versionSelectorRef.current.refreshVersions()
                        }
                    }
                }

                handleChatFinish()
            } catch (error) {
                console.error('Failed in onFinish:', error)
                setErrorState(error as Error)
            } finally {
                setIsCreatingVersion(false)
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
                        const url = await updateSandbox(code, forceExecute, currentChatId || undefined)
                        if (url) {
                            setStreamlitUrl(url)
                            if (streamlitPreviewRef.current?.refreshIframe) {
                                streamlitPreviewRef.current.refreshIframe()
                                await new Promise((resolve) =>
                                    setTimeout(resolve, 2000)
                                )
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
        [updateSandbox, setStreamlitUrl, setGeneratingCode, setIsLoadingSandbox, currentChatId]
    )

    // Improved file upload with abort controller
    const handleFileUpload = useCallback(
        async (file: File) => {
            // Abort any existing upload
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }

            abortControllerRef.current = new AbortController()
            setFileUploadState({ isUploading: true, progress: 0, error: null })

            try {
                const formData = new FormData()
                formData.append('file', file)

                // Always include current chat ID if it exists
                if (currentChatId) {
                    formData.append('chatId', currentChatId)
                }

                const uploadResponse = await fetch('/api/files', {
                    method: 'POST',
                    body: formData,
                    signal: abortControllerRef.current.signal,
                })

                if (!uploadResponse.ok) throw new Error('Upload failed')
                const fileData = await uploadResponse.json()

                if (isNewChat) {
                    pendingFileLinkId.current = fileData.id
                }

                const fileContent = await file.text()
                const sanitizedContent = fileContent
                    .split('\n')
                    .map((row) => row.replace(/[\r\n]+/g, ''))
                    .join('\n')

                const rows = sanitizedContent.split('\n')
                const columnNames = rows[0]
                const previewRows = rows.slice(1, 6).join('\n')

                await append(
                    {
                        content: `Create a Streamlit app to visualize this data.`,
                        role: 'user',
                        createdAt: new Date(),
                    },
                    {
                        body: {
                            chatId: currentChatId,
                            fileId: fileData.id,
                            fileName: file.name,
                            fileContent: sanitizedContent,
                        },
                    }
                )

                setFileUploadState({
                    isUploading: false,
                    progress: 100,
                    error: null,
                })
            } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Error uploading file:', error)
                    setFileUploadState({
                        isUploading: false,
                        progress: 0,
                        error: 'Failed to upload file. Please try again.',
                    })
                }
            }
        },
        [append, currentChatId]
    )

    // Event handlers
    const handleSubmit = useCallback(
        async (e: React.FormEvent, message: string, file?: File) => {
            e.preventDefault()
            setHasFirstMessage(true)
            originalHandleSubmit(e)
            updateChatState({ status: 'active' })
        },
        [originalHandleSubmit, updateChatState]
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
        if (sandboxId && session?.user?.id) {
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
        sandboxId,
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
        (chatId: string) => {
            router.push(`/chat/${chatId}`)
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

    const handleChatFinish = useCallback(() => {
        if (versionSelectorRef.current) {
            versionSelectorRef.current.refreshVersions()
        }
    }, [])

    const toggleRightContent = useCallback(() => {
        setRightPanel((prev) => ({
            ...prev,
            isVisible: !prev.isVisible,
        }))
    }, [])

    // Effects
    // useEffect(() => {
    //     if (chatLoading) {
    //         setGeneratingCode(true)
    //         setGeneratedCode('')
    //     }
    // }, [chatLoading, setGeneratingCode, setGeneratedCode])

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
            if (
                !currentChatId ||
                isVersionSwitching.current ||
                hasInitialized.current
            )
                return

            hasInitialized.current = true

            try {
                if (initialMessages?.length) {
                    setMessages(initialMessages)
                }

                if (!initialAppId && !currentAppId) {
                    const chatResponse = await fetch(
                        `/api/chats/${currentChatId}`
                    )
                    const chatData = await chatResponse.json()
                    setCurrentAppId(chatData.app_id)
                }

                const versionData = Array.isArray(initialVersion)
                    ? initialVersion[0]
                    : initialVersion

                if (versionData?.code) {
                    setRightPanel((prev) => ({
                        ...prev,
                        isVisible: true,
                    }))
                    setGeneratedCode(versionData.code)
                    await updateStreamlitApp(versionData.code, true)
                }

                if (!initialMessages?.length) {
                    const messagesResponse = await fetch(
                        `/api/chats/messages?chatId=${currentChatId}`
                    )
                    if (!messagesResponse.ok)
                        throw new Error('Failed to fetch messages')
                    const data = await messagesResponse.json()

                    if (data.messages?.length) {
                        setMessages(formatDatabaseMessages(data.messages))

                        const lastStreamlitCode = data.messages
                            .filter((msg: any) => msg.tool_results?.length)
                            .map((msg: any) => {
                                const toolResult = msg.tool_results.find(
                                    (t: any) => t.name === 'streamlitTool'
                                )
                                return toolResult?.result
                            })
                            .filter(Boolean)
                            .pop()

                        if (lastStreamlitCode) {
                            setRightPanel((prev) => ({
                                ...prev,
                                isVisible: true,
                            }))
                            setGeneratingCode(true)
                            setGeneratedCode(lastStreamlitCode)
                            await updateStreamlitApp(lastStreamlitCode, true)
                        }
                    }
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
            if (sandboxId) {
                killSandbox().catch(console.error)
            }
            isExecutingRef.current = false
            setStreamlitUrl(null)
            setGeneratedCode('')
        }
    }, [sandboxId, killSandbox, setStreamlitUrl, setGeneratedCode])

    // Title generation
    const generateTitle = useCallback(
        async (chatId: string) => {
            // Prevent duplicate generations for same chat
            if (titleGeneratedRef.current.has(chatId)) {
                return null
            }

            try {
                // Check current chat name in database
                const chatResponse = await fetch(`/api/chats/${chatId}`)
                const chatData = await chatResponse.json()
                
                // Only generate if it's the default name
                if (chatData.chat?.name !== 'New Chat') {
                    titleGeneratedRef.current.add(chatId)
                    return null
                }

                console.log('🎯 Generating title for chat:', chatId)
                const response = await fetch('/api/title', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chatId }),
                })

                if (!response.ok) throw new Error('Failed to generate title')

                const title = await response.text()
                console.log('✨ Generated title:', title)

                // Update local state
                setChatTitles(prev => ({ ...prev, [chatId]: title }))
                titleGeneratedRef.current.add(chatId)

                // Refresh chats list
                const chatsResponse = await fetch('/api/chats')
                if (chatsResponse.ok) {
                    const data = await chatsResponse.json()
                    setSidebarChats(data.chats)
                }

                return title
            } catch (error) {
                console.error('❌ Error in generateTitle:', error)
                return null
            }
        },
        [setSidebarChats]
    )

    // Add this useEffect to trigger title generation for new chats
    useEffect(() => {
        if (currentChatId && !chatTitles[currentChatId]) {
            console.log(
                '🔄 Triggering title generation for new chat:',
                currentChatId
            )
            generateTitle(currentChatId)
        }
    }, [currentChatId])

    // Loading states
    if (isLoading) {
        return <div>Loading...</div>
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
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="godrays top-0 left-0 w-full min-h-[30vh] relative z-5">
                    <div className="godrays-overlay dark:mix-blend-darken z-10" />
                </div>
            </div>
            <AppSidebar
                onChatSelect={handleChatSelect}
                currentChatId={currentChatId}
                chats={sidebarChats}
                isCreatingChat={isCreatingChat}
                chatTitles={chatTitles}
                onGenerateTitle={generateTitle}
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
                                        messages={messages}
                                        isLoading={chatLoading}
                                        input={input}
                                        onInputChange={handleInputChange}
                                        onSubmit={handleSubmit}
                                        fileUploadState={fileUploadState}
                                        onFileUpload={handleFileUpload}
                                        errorState={errorState}
                                        onErrorDismiss={() =>
                                            setErrorState(null)
                                        }
                                        onChatFinish={handleChatFinish}
                                        onUpdateStreamlit={updateStreamlitApp}
                                        onCodeClick={() => {
                                            setRightPanel((prev) => ({
                                                ...prev,
                                                view: 'code',
                                            }))
                                        }}
                                        isInChatPage={
                                            isInChatPage || hasFirstMessage
                                        }
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

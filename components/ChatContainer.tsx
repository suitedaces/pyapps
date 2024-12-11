// components/ChatContainer.tsx
'use client'

import { Chat } from '@/components/Chat'
import LoginPage from '@/components/LoginPage'
import { PreviewPanel } from '@/components/PreviewPanel'
import AppSidebar from './Sidebar'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import modelsList from '@/lib/models.json'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { AppVersion, LLMModelConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useChat } from 'ai/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { VersionSelector } from '../components/VersionSelector'
import { TypingText } from './core/typing-text'
import { formatDatabaseMessages } from '@/lib/utils'

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

export default function ChatContainer({
    initialChat,
    initialMessages = [],
    initialVersion = null,
    isNewChat = false,
    isInChatPage = false,
    initialFiles = []
}: ChatContainerProps) {
    const router = useRouter()
    const { session, isLoading } = useAuth()
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const {
        streamlitUrl,
        isGeneratingCode,
        isLoadingSandbox,
        generatedCode,
        updateSandbox,
        killSandbox,
        setGeneratingCode,
        setStreamlitUrl,
        setIsLoadingSandbox,
        setGeneratedCode
    } = useSandboxStore()

    // State management
    const [sidebarChats, setSidebarChats] = useState<any[]>([])
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [currentChatId, setCurrentChatId] = useState<string | null>(initialChat?.id || null)
    const [showTypingText, setShowTypingText] = useState(true)
    const [activeTab, setActiveTab] = useState('preview')
    const [currentApp, setCurrentApp] = useState<{ id: string | null }>({ id: null })
    const [showCodeView, setShowCodeView] = useState(false)
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [sandboxErrors, setSandboxErrors] = useState<Array<{ message: string }>>([])
    const [isCreatingVersion, setIsCreatingVersion] = useState(false)
    const [errorState, setErrorState] = useState<Error | null>(null)
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        isUploading: false,
        progress: 0,
        error: null,
    })
    const [hasFirstMessage, setHasFirstMessage] = useState(false)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const [chatTitles, setChatTitles] = useState<Record<string, string>>({})

    const newChatIdRef = useRef<string | null>(null)

    // Refs
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

    // Simplified chat creation handler
    const handleChatCreated = useCallback((chatId: string) => {
        if (!hasNavigated.current && isNewChat) {
            hasNavigated.current = true
            router.replace(`/chat/${chatId}`)
            return
        }

        setShowTypingText(false)
        setCurrentChatId(chatId)

        // Refresh chat list
        const loadChats = async () => {
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
    }, [router, isNewChat])

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
            chatId: currentChatId, // Add this to ensure chat ID is passed
            model: currentModel,
            config: languageModel,
            experimental_streamData: true,
        },
        onResponse: async (response) => {
            const newChatId = response.headers.get('x-chat-id')
            if (newChatId && !currentChatId) {
                newChatIdRef.current = newChatId
                console.log('🚀 New chat created:', newChatId)
            }
        },
        onToolCall: async ({ toolCall }) => {
            const streamlitToolCall = toolCall as unknown as StreamlitToolCall
            if (streamlitToolCall.toolName === 'streamlitTool') {
                setIsRightContentVisible(true)
                setShowCodeView(true)
                setGeneratingCode(true)

                try {
                    if (streamlitToolCall.state === 'result' && streamlitToolCall.result?.code) {
                        setGeneratedCode(streamlitToolCall.result.code)
                        await updateSandbox(streamlitToolCall.result.code)
                    }
                } finally {
                    setGeneratingCode(false)
                }
            }
        },
        onFinish: async (message, { usage }) => {
            if (message.content && newChatIdRef.current) {
                // Only handle chat creation for new chats
                handleChatCreated(newChatIdRef.current)
                newChatIdRef.current = null // Reset after handling
            }

            // Handle tool results
            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .find(invocation =>
                        invocation.toolName === 'streamlitTool' &&
                        invocation.state === 'result'
                    )

                if (streamlitCall?.state === 'result' && streamlitCall.result?.code) {
                    try {
                        setIsCreatingVersion(true)
                        setGeneratedCode(streamlitCall.result.code)
                        await updateStreamlitApp(streamlitCall.result.code)
                        if (versionSelectorRef.current) {
                            await versionSelectorRef.current.refreshVersions()
                        }
                    } finally {
                        setIsCreatingVersion(false)
                    }
                }
            }

            handleChatFinish()
        }
    })

    // Streamlit app management
    const updateStreamlitApp = useCallback(async (code: string, forceExecute = false) => {
        if (!code) {
            setStreamlitUrl(null)
            setGeneratingCode(false)
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
            setGeneratingCode(false)
        }
    }, [updateSandbox, setStreamlitUrl, setGeneratingCode, setIsLoadingSandbox])

    // File handling with chat ID context
    const handleFileUpload = useCallback(async (file: File) => {
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
            })

            if (!uploadResponse.ok) throw new Error('Upload failed')
            const fileData = await uploadResponse.json()

            // Create file preview message with chat context
            const fileContent = await file.text()
            const sanitizedContent = fileContent
                .split('\n')
                .map((row) => row.replace(/[\r\n]+/g, ''))
                .join('\n')

            const rows = sanitizedContent.split('\n')
            const columnNames = rows[0]
            const previewRows = rows.slice(1, 6).join('\n')
            const dataPreview = `⚠️ EXACT column names:\n${columnNames}\n\nFirst 5 rows:\n${previewRows}`

            const message = `Create a Streamlit app to visualize this data. The file is stored in the directory '/app/' and is named "${file.name}". Ensure all references to the file use the full path '/app/${file.name}'.\n${dataPreview}\nCreate a complex, aesthetic visualization using these exact column names.`

            // Send message with file and chat context
            await append(
                {
                    content: message,
                    role: 'user',
                    createdAt: new Date(),
                },
                {
                    body: {
                        chatId: currentChatId, // Always include current chat ID
                        fileId: fileData.id,
                        fileName: file.name,
                        fileContent: sanitizedContent,
                    },
                }
            )

            setFileUploadState({ isUploading: false, progress: 100, error: null })

        } catch (error) {
            console.error('Error uploading file:', error)
            setFileUploadState({
                isUploading: false,
                progress: 0,
                error: 'Failed to upload file. Please try again.'
            })
        }
    }, [append, currentChatId])

    // Event handlers
    const handleSubmit = useCallback(async (e: React.FormEvent, message: string, file?: File) => {
        e.preventDefault()
        setShowTypingText(false)
        setHasFirstMessage(true)
        originalHandleSubmit(e)
    }, [originalHandleSubmit])

    const handleInputChange = useCallback((value: string) => {
        originalHandleInputChange({ target: { value } } as React.ChangeEvent<HTMLTextAreaElement>)
    }, [originalHandleInputChange])

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
    }, [sandboxId, session?.user?.id, generatedCode, updateStreamlitApp, setGeneratingCode])

    const handleCodeViewToggle = useCallback(() => {
        setShowCodeView(prev => !prev)
    }, [])

    const handleChatSelect = useCallback((chatId: string) => {
        router.push(`/chat/${chatId}`)
    }, [router])

    const handleVersionChange = useCallback(async (version: AppVersion) => {
        if (!version.code) return

        isVersionSwitching.current = true
        setGeneratingCode(true)

        try {
            setGeneratedCode(version.code)
            await updateStreamlitApp(version.code, true)
        } catch (error) {
            setSandboxErrors(prev => [...prev, {
                message: error instanceof Error ? error.message : 'Error updating version'
            }])
        } finally {
            setGeneratingCode(false)
            isVersionSwitching.current = false
        }
    }, [updateStreamlitApp, setGeneratingCode, setGeneratedCode])

    const handleChatFinish = useCallback(() => {
        if (versionSelectorRef.current) {
            versionSelectorRef.current.refreshVersions()
        }
    }, [])

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible(prev => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'))
            }, 0)
        }
    }, [])

    // Effects
    useEffect(() => {
        if (chatLoading) {
            setGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [chatLoading, setGeneratingCode, setGeneratedCode])

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
            if (!currentChatId) return

            try {
                // Set initial messages first if they exist
                if (initialMessages?.length) {
                    console.log('Setting initial messages:', initialMessages.length)
                    setMessages(initialMessages)
                }

                // Handle version initialization
                const versionData = Array.isArray(initialVersion) ? initialVersion[0] : initialVersion

                if (versionData?.code) {
                    console.log('Initializing with version:', versionData.version_id)
                    setIsRightContentVisible(true)
                    setIsLoadingSandbox(true)
                    setGeneratedCode(versionData.code)
                    await updateStreamlitApp(versionData.code, true)
                    return
                }

                // Only fetch messages if we don't have initial messages
                if (!initialMessages?.length) {
                    const messagesResponse = await fetch(`/api/chats/messages?chatId=${currentChatId}`)
                    if (!messagesResponse.ok) throw new Error('Failed to fetch messages')
                    const data = await messagesResponse.json()

                    if (data.messages?.length) {
                        setMessages(formatDatabaseMessages(data.messages))

                        const lastStreamlitCode = data.messages
                            .filter((msg: any) => msg.tool_results?.length)
                            .map((msg: any) => {
                                const toolResult = msg.tool_results.find((t: any) => t.name === 'streamlitTool')
                                return toolResult?.result
                            })
                            .filter(Boolean)
                            .pop()

                        if (lastStreamlitCode) {
                            setIsRightContentVisible(true)
                            setIsLoadingSandbox(true)
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
    }, [
        currentChatId,
        initialVersion,
        initialMessages,
        updateStreamlitApp,
        setMessages,
        setGeneratedCode,
        setGeneratingCode,
        setIsLoadingSandbox,
        setIsRightContentVisible,
        setErrorState
    ])

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (sandboxId) {
                fetch(`/api/sandbox/${sandboxId}/kill`, {
                    method: 'POST',
                }).catch(console.error)
            }
            isExecutingRef.current = false
            setStreamlitUrl(null)
            setGeneratedCode('')
            setIsLoadingSandbox(false)
        }
    }, [sandboxId, setStreamlitUrl, setGeneratedCode, setIsLoadingSandbox])

    // Title generation
    const generateTitle = useCallback(async (chatId: string) => {
        console.log('🎯 Starting title generation for chat:', chatId)
        try {
            const response = await fetch('/api/chats/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId,
                    isTitleGeneration: true,
                    messages: []
                })
            })

            if (!response.ok) throw new Error('Failed to generate title')

            const title = await response.text()
            console.log('✨ Generated title:', title)

            // Update local state
            setChatTitles(prev => ({ ...prev, [chatId]: title }))

            // Refresh chats list immediately
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
    }, [setSidebarChats])

    // Add this useEffect to trigger title generation for new chats
    useEffect(() => {
        if (currentChatId && !chatTitles[currentChatId]) {
            console.log('🔄 Triggering title generation for new chat:', currentChatId)
            generateTitle(currentChatId)
        }
    }, [currentChatId])

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
                            <div className={cn(
                                "w-full relative flex flex-col",
                                hasFirstMessage || isInChatPage ? "h-[calc(100vh-4rem)]" : "h-screen"
                            )}>
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
                                        messages={messages}
                                        isLoading={chatLoading}
                                        input={input}
                                        onInputChange={handleInputChange}
                                        onSubmit={handleSubmit}
                                        fileUploadState={fileUploadState}
                                        onFileUpload={handleFileUpload}
                                        errorState={errorState}
                                        onErrorDismiss={() => setErrorState(null)}
                                        onChatFinish={handleChatFinish}
                                        onUpdateStreamlit={updateStreamlitApp}
                                        onCodeClick={() => {
                                            setActiveTab('code')
                                            setIsRightContentVisible(true)
                                        }}
                                        isInChatPage={isInChatPage || hasFirstMessage}
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

'use client'

import { Chat } from '@/components/Chat'
import { Logo } from '@/components/core/Logo'
import LoginPage from '@/components/LoginPage'
import { PreviewPanel } from '@/components/PreviewPanel'
import { Sidebar } from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import modelsList from '@/lib/models.json'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { AppVersion, LLMModelConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { useChat } from 'ai/react'
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

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}


export default function ChatContainer({ initialChat, isNewChat = false, isInChatPage = false }: ChatContainerProps) {
    const router = useRouter()
    const { session, isLoading } = useAuth()
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const { killSandbox, updateSandbox } = useSandboxStore()

    // state declarations 
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
    const [errorState, setErrorState] = useState<Error | null>(null)

    // refs
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
        input,
        handleInputChange: originalHandleInputChange,
        handleSubmit: originalHandleSubmit,
        append,
    } = useChat({
        api: '/api/chat/stream',
        id: currentChatId ?? undefined,
        initialMessages,
        body: {
            model: currentModel,
            config: languageModel,
            chatId: currentChatId,
            experimental_streamData: true,
        },
        onResponse: async (response) => {
            if (!response.ok) {
                handleResponseError(response)
                return
            }

            // Handle chat creation
            if (!currentChatId) {
                const newChatId = response.headers.get('x-chat-id')
                if (newChatId && isNewChat) {
                    router.replace(`/chat/${newChatId}`)
                }
            }
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
                            if (versionSelectorRef.current) {
                                await versionSelectorRef.current.refreshVersions()
                            }
                        } catch (error) {
                            console.error('Failed to handle streamlit update:', error)
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
            
            handleChatFinish()
        },
        onError: (error) => {
            setIsGeneratingCode(false)
            setErrorState(new Error(error.message))
        }
    })

    // Create a wrapped handleSubmit
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        setShowTypingText(false)
        await originalHandleSubmit(e)
    }, [originalHandleSubmit])

    // File handling logic moved from Chat.tsx
    const [attachedFile, setAttachedFile] = useState<File | null>(null)
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        isUploading: false,
        progress: 0,
        error: null,
    })

    // Error handling moved from Chat.tsx
    const handleResponseError = (response: Response) => {
        const errorMessage =
            response.status === 429
                ? 'Rate limit exceeded. Please wait a moment.'
                : response.status === 413
                    ? 'Message too long. Please try a shorter message.'
                    : 'An error occurred. Please try again.'
    }

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
    }, [])

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
                // Trigger resize event to update panel layout
                window.dispatchEvent(new Event('resize'))
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

    const handleFileUpload = useCallback(async (file: File) => {
        setFileUploadState({ isUploading: true, progress: 0, error: null })
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('chatId', currentChatId || '')
            
            // Read and process file content
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

            // Upload file
            const response = await fetch('/api/chat/stream/upload', {
                method: 'POST',
                body: formData,
            })
            
            if (!response.ok) throw new Error('Upload failed')
            const fileData = await response.json()

            // Send message with file context
            await append(
                {
                    content: message,
                    role: 'user',
                    createdAt: new Date(),
                },
                {
                    body: {
                        fileId: fileData.id,
                        fileName: file.name,
                        fileContent: sanitizedContent,
                    },
                }
            )

            setAttachedFile(null)
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

    // Reset file upload state
    const resetFileUploadState = useCallback(() => {
        setFileUploadState({
            isUploading: false,
            progress: 0,
            error: null,
        })
    }, [])

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

    // Remove the messages effect since we handle visibility in submit
    useEffect(() => {
        if (messages.length > 0) {
            setShowTypingText(false)
        }
    }, [messages])
    
    const handleInputChange = useCallback((value: string) => {
        // Convert string value to synthetic event
        originalHandleInputChange({ target: { value } } as React.ChangeEvent<HTMLTextAreaElement>)
    }, [originalHandleInputChange])

    // All useCallbacks here, including handleUpdateStreamlit
    const handleUpdateStreamlit = useCallback(async (code: string): Promise<void> => {
        await updateStreamlitApp(code)
    }, [updateStreamlitApp])

    // Loading states
    if (isLoading) {
        return <div>Loading...</div>
    }

    if (!session) {
        return <LoginPage />
    }

    const CustomHandle = ({ ...props }) => (
        <ResizableHandle {...props} withHandle className="relative">
            <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
                <div className="h-8 w-1 rounded-full bg-black" />
            </div>
        </ResizableHandle>
    )


    return (
        <div className="bg-white relative flex h-screen overflow-hidden">
            <div className='bg-white absolute top-0 left-0 w-full h-full'>
                <div className="godrays top-0 left-0 w-full min-h-[30vh] relative z-5">
                    <div className="godrays-overlay z-10" />
                </div>
            </div>
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
                        <ResizablePanel defaultSize={40} minSize={30}>
                            <div className="w-full relative flex flex-col h-[calc(100vh-4rem)]">
                                {!isInChatPage && showTypingText && <TypingText className='text-black font-bold text-3xl' text='From Data to Apps, in seconds' speed={30} show={true} />}
                                <div className="max-w-[800px] mx-auto w-full h-full">
                                    <Chat
                                        messages={messages}
                                        isLoading={chatLoading}
                                        input={input}
                                        onInputChange={handleInputChange}
                                        onSubmit={handleSubmit}
                                        fileUploadState={fileUploadState}
                                        onFileUpload={(file: File) => {
                                            setAttachedFile(file)
                                            handleFileUpload(file)
                                        }}
                                        errorState={errorState}
                                        onErrorDismiss={() => setErrorState(null)}
                                        onChatFinish={handleChatFinish}
                                        onUpdateStreamlit={handleUpdateStreamlit}
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
    )
}
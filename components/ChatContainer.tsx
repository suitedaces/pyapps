// components/ChatContainer.tsx
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
import { useToolState } from '@/lib/stores/tool-state-store'
import { AppVersion, LLMModelConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { useChat, useStreamData } from 'ai/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { VersionSelector } from '../components/VersionSelector'
import { TypingText } from './core/typing-text'

interface ChatContainerProps {
    initialChat?: any
    initialMessages?: any[]
    isNewChat?: boolean
    isInChatPage?: boolean
}

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

export default function ChatContainer({ 
    initialChat, 
    initialMessages = [], 
    isNewChat = false, 
    isInChatPage = false 
}: ChatContainerProps) {
    const router = useRouter()
    const { session, isLoading } = useAuth()
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const { killSandbox, updateSandbox } = useSandboxStore()
    const { setToolState, currentToolCall } = useToolState()

    // State management
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [currentChatId, setCurrentChatId] = useState<string | null>(initialChat?.id || null)
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
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        isUploading: false,
        progress: 0,
        error: null,
    })

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

    // Chat configuration with streaming
    const {
        messages,
        isLoading: chatLoading,
        input,
        handleInputChange: originalHandleInputChange,
        handleSubmit: originalHandleSubmit,
        append,
        setMessages,
    } = useChat({
        api: '/api/chat/stream',
        id: currentChatId ?? undefined,
        initialMessages: initialMessages?.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.role === 'user' ? msg.user_message : msg.assistant_message,
            createdAt: new Date(msg.created_at),
            toolInvocations: msg.tool_results?.map((tool: any) => ({
                toolName: tool.name,
                toolCallId: tool.id,
                state: 'result',
                result: tool.result
            }))
        })),
        body: {
            model: currentModel,
            config: languageModel,
            chatId: currentChatId,
            experimental_streamData: true,
        },
        onToolCall: async ({ toolCall, toolCallId }) => {
            if (toolCall.toolName === 'create_streamlit_app') {
                setToolState({
                    toolCallId,
                    toolName: toolCall.toolName,
                    state: 'streaming-start'
                })

                setIsRightContentVisible(true)
                setShowCodeView(true)
                setIsGeneratingCode(true)

                if (toolCall.state === 'partial-call' && toolCall.args) {
                    setGeneratedCode(prev => prev + toolCall.args)
                    setToolState({
                        toolCallId,
                        toolName: toolCall.toolName,
                        state: 'delta'
                    })
                } else if (toolCall.state === 'result') {
                    setGeneratedCode(toolCall.result)
                    await updateStreamlitApp(toolCall.result)
                    setIsGeneratingCode(false)
                    setToolState({
                        toolCallId,
                        toolName: toolCall.toolName,
                        state: 'complete'
                    })
                }
            }
        },
        onFinish: async (message) => {
            if (isNewChat && currentChatId) {
                router.replace(`/chat/${currentChatId}`)
            }

            handleChatFinish()
            
            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .find(invocation => 
                        invocation.toolName === 'create_streamlit_app' && 
                        invocation.state === 'result'
                    )

                if (streamlitCall?.state === 'result') {
                    try {
                        setIsCreatingVersion(true)
                        setGeneratedCode(streamlitCall.result)
                        await updateStreamlitApp(streamlitCall.result)
                        if (versionSelectorRef.current) {
                            await versionSelectorRef.current.refreshVersions()
                        }
                    } finally {
                        setIsCreatingVersion(false)
                    }
                }
            }
        },
        onError: (error) => {
            setIsGeneratingCode(false)
            setErrorState(new Error(error.message))
        }
    })

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

    // File handling
    const handleFileUpload = useCallback(async (file: File) => {
        setFileUploadState({ isUploading: true, progress: 0, error: null })
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('chatId', currentChatId || '')
            
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

            const response = await fetch('/api/chat/stream/upload', {
                method: 'POST',
                body: formData,
            })
            
            if (!response.ok) throw new Error('Upload failed')
            const fileData = await response.json()

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
        await originalHandleSubmit(e)
    }, [originalHandleSubmit])

    const handleInputChange = useCallback((value: string) => {
        originalHandleInputChange({ target: { value } } as React.ChangeEvent<HTMLTextAreaElement>)
    }, [originalHandleInputChange])

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
            if (!session?.user?.id) return
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
    }, [session?.user?.id])

    useEffect(() => {
        const initializeChat = async () => {
            if (!currentChatId) return

            try {
                setIsGeneratingCode(true)

                const messagesResponse = await fetch(`/api/conversations/${currentChatId}/messages`)
                if (!messagesResponse.ok) throw new Error('Failed to fetch messages')
                const data = await messagesResponse.json()

                if (!data.messages?.length) {
                    return // Don't try to set empty messages
                }

                const formattedMessages: Message[] = data.messages.flatMap((msg: any) => {
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
                            toolInvocations: msg.tool_results?.map((tool: any) => ({
                                toolName: tool.name,
                                toolCallId: tool.id,
                                state: 'result',
                                result: tool.result
                            }))
                        })
                    }
                    return messages
                })

                if (formattedMessages.length > 0) {
                    setMessages(formattedMessages)
                }

                // Find and set latest Streamlit code
                const lastStreamlitCode = data.messages
                    .filter((msg: any) => msg.tool_results?.length)
                    .map((msg: any) => {
                        const toolResult = msg.tool_results.find((t: any) => t.name === 'create_streamlit_app')
                        return toolResult?.result
                    })
                    .filter(Boolean)
                    .pop()

                if (lastStreamlitCode) {
                    setGeneratedCode(lastStreamlitCode)
                    await updateStreamlitApp(lastStreamlitCode, true)
                    setIsRightContentVisible(true)
                }

            } catch (error) {
                console.error('Error initializing chat:', error)
                setErrorState(error as Error)
            } finally {
                setIsGeneratingCode(false)
            }
        }

        initializeChat()
    }, [currentChatId, setMessages, updateStreamlitApp])

    // Cleanup effect
    useEffect(() => {
        return () => {
            killSandbox()
            isExecutingRef.current = false
        }
    }, [killSandbox])

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
                                {!isInChatPage && showTypingText && (
                                    <TypingText 
                                        className='text-black font-bold text-3xl' 
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
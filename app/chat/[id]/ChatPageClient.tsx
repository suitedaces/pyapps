'use client'

import { Chat } from '@/components/Chat'
import { CodeView } from '@/components/CodeView'
import LoginPage from '@/components/LoginPage'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { useChat } from 'ai/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Message } from 'ai'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'

import { Sidebar } from '@/components/Sidebar'

import { useLocalStorage } from 'usehooks-ts'
import { LLMModelConfig } from '@/lib/types'
import modelsList from '@/lib/models.json'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/core/Logo'
import { useSidebar } from '@/contexts/SidebarContext'

interface ChatPageClientProps {
    initialChat: {
        id: string;
    }
}

interface ChatState {
    currentChatId: string | null;
    isCreatingChat: boolean;
    initialMessages: Message[];
}

interface SandboxState {
    id: string | null;
    url: string | null;
    isGenerating: boolean;
    code: string;
    error: string | null;
}

interface StreamlitToolResult {
    toolName: string;
    state: 'result';
    output: string;
}

const SIDEBAR_COLLAPSED_LEFT = '4rem'
const DEFAULT_PANEL_SIZE = 65
const MIN_PANEL_SIZE = 45
const CHAT_HEIGHT_OFFSET = 'calc(100vh-4rem)'

const CustomHandle = ({ ...props }) => (
    <ResizableHandle {...props} withHandle className="relative">
        <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
            <div className="h-8 w-1 rounded-full bg-black" />
        </div>
    </ResizableHandle>
)

export default function ChatPageClient({
    initialChat,
}: ChatPageClientProps) {
    const [uiState, setUiState] = useState({
        isRightContentVisible: false,
        isAtBottom: true,
        loading: false,
        isCodeVisible: false
    })

    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()

    const [chatState, setChatState] = useState<ChatState>({
        currentChatId: initialChat.id,
        isCreatingChat: false,
        initialMessages: [],
    })

    const [sandbox, setSandbox] = useState<SandboxState>({
        id: null,
        url: null,
        isGenerating: false,
        code: '',
        error: null
    })

    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)

    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20240620',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    const { session, isLoading } = useAuth()

    const {
        messages,
        isLoading: chatLoading,
        setMessages
    } = useChat({
        api: chatState.currentChatId ? `/api/conversations/${chatState.currentChatId}/stream` : '/api/conversations/stream',
        id: chatState.currentChatId ?? undefined,
        initialMessages: chatState.initialMessages,
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
                        await updateStreamlitApp(code)
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
            if (!uiState.isRightContentVisible) {
                setUiState(prev => ({ ...prev, isRightContentVisible: true }))
            }
        }
    }, [chatLoading, uiState.isRightContentVisible])

    const handleSandboxError = useCallback((error: unknown, context: string) => {
        console.error(`Error in ${context}:`, error)
        setSandbox(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : `Error in ${context}`
        }))
    }, [])

    const initializeSandbox = useCallback(async () => {
        try {
            const response = await fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!response.ok) throw new Error('Failed to initialize sandbox')
            
            const data = await response.json()
            setSandbox(prev => ({ ...prev, id: data.sandboxId }))
            return data.sandboxId
        } catch (error) {
            console.error('Sandbox initialization failed:', error)
            setSandbox(prev => ({ ...prev, error: 'Failed to initialize sandbox' }))
            return null
        }
    }, [])

    const [initError, setInitError] = useState<string | null>(null)

    const updateStreamlitApp = useCallback(async (code: string) => {
        if (!code) return

        try {
            setSandbox(prev => ({ ...prev, isGenerating: true }))
            setInitError(null)
            
            // First get/ensure sandbox ID
            let sandboxId = sandbox.id
            if (!sandboxId) {
                const initResponse = await fetch('/api/sandbox/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                if (!initResponse.ok) throw new Error('Failed to initialize sandbox')
                const { sandboxId: newId } = await initResponse.json()
                sandboxId = newId
                setSandbox(prev => ({ ...prev, id: newId }))
            }

            // Execute code in sandbox
            const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            })

            if (!response.ok) throw new Error('Failed to execute code')
            
            const data = await response.json()
            setSandbox(prev => ({
                ...prev,
                url: data.url,
                code,
                isGenerating: false,
                error: null
            }))

            // Force right panel visibility when we have a URL
            if (data.url && !uiState.isRightContentVisible) {
                setUiState(prev => ({ 
                    ...prev, 
                    isRightContentVisible: true 
                }))
            }
        } catch (error) {
            console.error('Failed to update Streamlit app:', error)
            setInitError(error instanceof Error ? error.message : 'Failed to update app')
            setSandbox(prev => ({
                ...prev,
                isGenerating: false,
                error: error instanceof Error ? error.message : 'Failed to update app'
            }))
        }
    }, [sandbox.id, uiState.isRightContentVisible])

    // Handle new messages with Streamlit code
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
                setUiState(prev => ({ 
                    ...prev, 
                    isRightContentVisible: true,
                    isCodeVisible: true 
                }))
                updateStreamlitApp(streamlitCall.result)
            }
        }
    }, [messages, updateStreamlitApp])

    const resizableGroupRef = useRef<any>(null)
    const [sidebarChats, setSidebarChats] = useState<any[]>([])

    const router = useRouter()
    const { id } = useParams()

    useEffect(() => {
        async function fetchMessages() {
            try {
                setUiState(prev => ({ ...prev, loading: true }))
                const response = await fetch(`/api/conversations/${id}/messages`)
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
                        // Add tool invocations to assistant messages
                        const toolInvocations = msg.tool_results?.map((result: any) => ({
                            toolName: 'create_streamlit_app',
                            state: 'result',
                            result: result.result
                        })) || []

                        messages.push({
                            id: `${msg.id}-assistant`,
                            role: 'assistant',
                            content: msg.assistant_message,
                            toolInvocations
                        })
                    }
                    return messages
                })

                setChatState(prev => ({ ...prev, initialMessages: messages }))

                // Find and execute the last Streamlit code
                const lastStreamlitCode = data.messages
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

                if (lastStreamlitCode) {
                    setUiState(prev => ({ ...prev, isRightContentVisible: true }))
                    setGeneratedCode(lastStreamlitCode)
                    await updateStreamlitApp(lastStreamlitCode)
                }
            } catch (error) {
                console.error('Error fetching messages:', error)
            } finally {
                setUiState(prev => ({ ...prev, loading: false }))
            }
        }

        if (id) {
            fetchMessages()
        }
    }, [id, updateStreamlitApp])

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
            setChatState(prev => ({ ...prev, currentChatId: chatId }))
        }
    }, [])

    const handleChatSelect = useCallback(
        (chatId: string) => {
            setChatState(prev => ({ ...prev, currentChatId: chatId }))
            router.replace(`/chat/${chatId}`, { scroll: false })
        },
        [router]
    )

    const handleNewChat = useCallback(async () => {
        setChatState(prev => ({ ...prev, currentChatId: null }))
        router.replace('/', { scroll: false })
        return Promise.resolve()
    }, [router])

    // Handle chat creation callback
    const handleChatCreated = useCallback((chatId: string) => {
        setChatState(prev => ({ ...prev, currentChatId: chatId }))
        router.replace(`/chat/${chatId}`)
    }, [router])

    const toggleRightContent = useCallback(() => {
        setUiState(prev => ({ ...prev, isRightContentVisible: !prev.isRightContentVisible }))
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [])

    const handleRerun = useCallback(async () => {
        if (!sandbox.id || !generatedCode) return

        try {
            setSandbox(prev => ({ 
                ...prev, 
                isGenerating: true
            }))

            const response = await fetch(`/api/sandbox/${sandbox.id}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: generatedCode }),
            })

            if (!response.ok) throw new Error('Failed to refresh sandbox')

            const data = await response.json()
            setSandbox(prev => ({
                ...prev,
                url: data.url,
                isGenerating: false
            }))
        } catch (error) {
            console.error('Error refreshing sandbox:', error)
            setSandbox(prev => ({
                ...prev,
                isGenerating: false,
                error: error instanceof Error ? error.message : 'Failed to refresh app'
            }))
        }
    }, [sandbox.id, generatedCode])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sandbox.id) {
                fetch(`/api/sandbox/${sandbox.id}/cleanup`, { method: 'POST' })
                    .catch(error => console.error('Error cleaning up sandbox:', error))
            }
        }
    }, [sandbox.id])

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
                currentChatId={chatState.currentChatId}
                chats={sidebarChats}
                collapsed={sidebarCollapsed}
                onCollapsedChange={setSidebarCollapsed}
            />
            <div className={cn(
                "flex-1 flex flex-col bg-white min-w-0 transition-all duration-200",
                "relative"
            )}>
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
                    <ResizablePanelGroup
                        direction="horizontal"
                        ref={resizableGroupRef}
                    >
                        <ResizablePanel defaultSize={DEFAULT_PANEL_SIZE} minSize={MIN_PANEL_SIZE}>
                            <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                                <Chat
                                    chatId={chatState.currentChatId}
                                    initialMessages={chatState.initialMessages}
                                    onChatCreated={handleChatCreated}
                                />
                            </div>
                        </ResizablePanel>

                        {uiState.isRightContentVisible && (
                            <CustomHandle className="bg-gradient-to-r from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 transition-colors" />
                        )}

                        {uiState.isRightContentVisible && (
                            <ResizablePanel
                                minSize={40}
                                className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden rounded-xl bg-white h-[calc(100vh-4rem)] border border-gray-200"
                            >
                                <StreamlitPreview
                                    onRerun={handleRerun}
                                    code={generatedCode}
                                />
                            </ResizablePanel>
                        )}
                    </ResizablePanelGroup>

                    <Button
                        onClick={toggleRightContent}
                        className={cn(
                            "fixed top-[3.5rem]",
                            sidebarCollapsed ? "right-3" : "right-4",
                            "z-50 bg-black hover:bg-black/90",
                            "text-white",
                            "border border-transparent",
                            "transition-all duration-200 ease-in-out",
                            "shadow-lg hover:shadow-xl",
                            "rounded-lg"
                        )}
                        size="icon"
                    >
                        {uiState.isRightContentVisible ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronLeft className="h-4 w-4" />
                        )}
                    </Button>
                </main>
            </div>
        </div>
    )
}

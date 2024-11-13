'use client'

import { Chat } from '@/components/Chat'
import { CodeView } from '@/components/CodeView'
import LoginPage from '@/components/LoginPage'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useChat } from 'ai/react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Message } from 'ai'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'

import AppSidebar from '@/components/Sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

import { useLocalStorage } from 'usehooks-ts'
import { LLMModelConfig } from '@/lib/types'
import modelsList from '@/lib/models.json'

interface ChatPageClientProps {
    initialChat: any
    initialSession: Session
}

const truncate = (str: string) => {
    const maxLength = 30 // Adjust this value as needed
    if (str.length <= maxLength) return str
    const extension = str.slice(str.lastIndexOf('.'))
    const nameWithoutExtension = str.slice(0, str.lastIndexOf('.'))
    const truncatedName = nameWithoutExtension.slice(
        0,
        maxLength - 3 - extension.length
    )
    return `${truncatedName}...${extension}`
}

const CustomHandle = ({ ...props }) => (
    <ResizableHandle {...props} withHandle className="relative">
        <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
            <div className="h-8 w-1 rounded-full bg-black" />
        </div>
    </ResizableHandle>
)

export default function ChatPageClient({
    initialChat,
    initialSession,
}: ChatPageClientProps) {
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [session, setSession] = useState<Session | null>(initialSession)
    const [currentChatId, setCurrentChatId] = useState<string | null>(initialChat.id)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const [initialMessages, setInitialMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)

    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [csvFileName, setCsvFileName] = useState<string | null>(null)
    const [csvContent, setCsvContent] = useState<string | null>(null)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)

    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20240620',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    const supabase = createClientComponentClient()
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit: originalHandleSubmit,
        isLoading,
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
        if (isLoading) {
            setIsGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [isLoading])

    // Add sandbox state
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [sandboxErrors, setSandboxErrors] = useState<Array<{ message: string }>>([])

    // Add sandbox initialization
    const initializeSandbox = useCallback(async () => {
        try {
            const response = await fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            setSandboxId(data.sandboxId)
        } catch (error) {
            setSandboxErrors(prev => [...prev, { message: 'Error initializing sandbox' }])
        }
    }, [])

    // Add streamlit update function
    const updateStreamlitApp = useCallback(async (code: string) => {
        if (code && sandboxId) {
            try {
                const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                })

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const data = await response.json()
                if (data.url) {
                    setStreamlitUrl(data.url)
                } else {
                    throw new Error('No URL returned from sandbox API')
                }
            } catch (error) {
                setSandboxErrors(prev => [...prev, {
                    message: error instanceof Error ? error.message : 'Error updating Streamlit app'
                }])
            } finally {
                setIsGeneratingCode(false)
            }
        }
    }, [sandboxId])

    // Initialize sandbox on mount
    useEffect(() => {
        initializeSandbox()
    }, [initializeSandbox])

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

    const resizableGroupRef = useRef<any>(null)
    const [sidebarChats, setSidebarChats] = useState<any[]>([])

    const router = useRouter()
    const { id } = useParams()

    useEffect(() => {
        async function fetchMessages() {
            try {
                setLoading(true)
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
        }

        if (id) {
            fetchMessages()
        }
    }, [id])

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

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

    const handleChatSelect = useCallback(
        (chatId: string) => {
            setCurrentChatId(chatId)
            router.push(`/chat/${chatId}`, { scroll: false })
        },
        [router]
    )

    const handleNewChat = useCallback(async () => {
        setCurrentChatId(null)
        router.push('/', { scroll: false })
        return Promise.resolve()
    }, [router])

    // Handle chat creation callback
    const handleChatCreated = useCallback((chatId: string) => {
        setCurrentChatId(chatId)
        router.push(`/chat/${chatId}`)
    }, [router])

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible((prev) => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [])

    // fetch tool results when chatId changes
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

    if (!session) {
        return <LoginPage />
    }

    return (
        <SidebarProvider>
            <AppSidebar
                onChatSelect={handleChatSelect}
                onNewChat={handleNewChat}
                currentChatId={currentChatId}
                chats={sidebarChats}
                isCreatingChat={isCreatingChat}
            />
            <div className="flex flex-col min-h-screen w-full bg-bg text-white overflow-x-hidden">
                <main className="flex-grow flex px-2 pr-9 flex-col mt-9 lg:flex-row overflow-hidden justify-center relative">
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
                                />
                            </div>
                        </ResizablePanel>

                        {isRightContentVisible && <CustomHandle />}

                        {isRightContentVisible && (
                            <ResizablePanel
                                minSize={40}
                                className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden border-2 bg-white border-border h-[calc(100vh-4rem)]"
                            >
                                <Tabs
                                    defaultValue="file"
                                    // value={activeTab}
                                    // onValueChange={handleTabChange}
                                    className="flex-grow flex flex-col h-full"
                                >
                                    <TabsList
                                        // className={`grid w-full ${csvFileName ? 'grid-cols-3' : 'grid-cols-2'} mb-4`}
                                        className="grid w-full grid-cols-2 mb-4"
                                    >
                                        {csvFileName && (
                                            <TabsTrigger value="file">
                                                {truncate(csvFileName)}
                                            </TabsTrigger>
                                        )}
                                        <TabsTrigger value="preview">
                                            App
                                        </TabsTrigger>
                                        <TabsTrigger value="code">
                                            Code
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent
                                        value="preview"
                                        className="flex-grow"
                                    >
                                        <StreamlitPreview
                                            url={streamlitUrl}
                                            isGeneratingCode={isGeneratingCode}
                                        />
                                    </TabsContent>
                                    <TabsContent
                                        value="code"
                                        className="flex-grow"
                                    >
                                        <CodeView
                                            code={generatedCode}
                                            isGeneratingCode={isGeneratingCode}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </ResizablePanel>
                        )}
                    </ResizablePanelGroup>
                    <Button
                        onClick={toggleRightContent}
                        className="absolute top-2 right-4 z-10 bg-main text-text"
                        size="icon"
                    >
                        {isRightContentVisible ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronLeft className="h-4 w-4" />
                        )}
                    </Button>
                </main>
            </div>
        </SidebarProvider>
    )
}

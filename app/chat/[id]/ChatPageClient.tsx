'use client'

import { Chat } from '@/components/Chat'
import { CodeView } from '@/components/CodeView'
import LoginPage from '@/components/LoginPage'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    initialChat: any
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
}: ChatPageClientProps) {
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [currentChatId, setCurrentChatId] = useState<string | null>(initialChat.id)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const [initialMessages, setInitialMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()

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
        if (chatLoading) {
            setIsGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [chatLoading])

    //  sandbox state
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [sandboxErrors, setSandboxErrors] = useState<Array<{ message: string }>>([])

    //  sandbox initialization
    const initializeSandbox = useCallback(async () => {
        try {
            console.log('Initializing sandbox...');
            const response = await fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json()
            console.log('Sandbox initialized with ID:', data.sandboxId);
            setSandboxId(data.sandboxId)
        } catch (error) {
            console.error('Error initializing sandbox:', error);
            setSandboxErrors(prev => [...prev, {
                message: error instanceof Error ? error.message : 'Error initializing sandbox'
            }])
        }
    }, [])

    //  streamlit update function
    const updateStreamlitApp = useCallback(async (code: string) => {
        if (!code) {
            console.error('No code provided to updateStreamlitApp');
            return;
        }

        if (!sandboxId) {
            console.error('No sandboxId available');
            return;
        }

        try {
            console.log('Updating Streamlit app with code:', code);
            const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json()
            console.log('Sandbox API response:', data);

            if (data.url) {
                setStreamlitUrl(data.url)
                setIsGeneratingCode(false)
            } else {
                throw new Error('No URL returned from sandbox API')
            }
        } catch (error) {
            console.error('Error in updateStreamlitApp:', error);
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
            router.replace(`/chat/${chatId}`, { scroll: false })
        },
        [router]
    )

    const handleNewChat = useCallback(async () => {
        setCurrentChatId(null)
        router.replace('/', { scroll: false })
        return Promise.resolve()
    }, [router])

    // Handle chat creation callback
    const handleChatCreated = useCallback((chatId: string) => {
        setCurrentChatId(chatId)
        router.replace(`/chat/${chatId}`)
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
                    "flex-1 flex flex-col bg-white min-w-0 transition-all duration-200",
                    "relative"
                )}
            >
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
                        <ResizablePanel defaultSize={65} minSize={45}>
                            <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                                <Chat
                                    chatId={currentChatId}
                                    initialMessages={initialMessages}
                                    onChatCreated={handleChatCreated}
                                />
                            </div>
                        </ResizablePanel>

                        {isRightContentVisible && (
                            <CustomHandle
                                className="bg-gradient-to-r from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 transition-colors"
                            />
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
                                        <CodeView
                                            code={generatedCode}
                                            isGeneratingCode={isGeneratingCode}
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
                                "rounded-lg"
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
    )
}

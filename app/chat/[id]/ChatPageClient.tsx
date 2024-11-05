'use client'

import { Chat } from '@/components/Chat'
import { CodeView } from '@/components/CodeView'
import LoginPage from '@/components/LoginPage'
import { MetaSheet } from '@/components/MetaSheet'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useChat } from '@/hooks/useChat'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'

import AppSidebar from '@/components/Sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { ClientMessage } from '@/lib/types'

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
    const [isRightContentVisible, setIsRightContentVisible] = useState(true)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [session, setSession] = useState<Session | null>(initialSession)
    const [currentChatId, setCurrentChatId] = useState<string | null>(
        initialChat.id
    )
    const [isCreatingChat, setIsCreatingChat] = useState(false)

    const supabase = createClientComponentClient()
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        handleFileUpload,
        csvFileName,
        csvContent,
        streamlitUrl,
        generatedCode,
        streamingMessage,
        isGeneratingCode,
        setMessages,
    } = useChat(currentChatId)

    const resizableGroupRef = useRef<any>(null)
    const [sidebarChats, setSidebarChats] = useState<any[]>([])

    const router = useRouter()

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
            router.replace(`/?chat=${chatId}`, { scroll: false })
        },
        [router]
    )

    const handleNewChat = useCallback(async () => {
        setCurrentChatId(null)
        router.replace('/', { scroll: false })
        return Promise.resolve()
    }, [router])

    const handleInputChangeWrapper = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            handleInputChange(e as React.ChangeEvent<HTMLInputElement>)
        },
        [handleInputChange]
    )

    const handleSubmitWrapper = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        console.log('Submit wrapper called, currentChatId:', currentChatId)

        if (!session) {
            console.log('No session')
            return
        }

        try {
            // Always create a new chat if there isn't one
            if (!currentChatId) {
                console.log('Creating new chat...')
                try {
                    const response = await fetch('/api/conversations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: 'New Chat' })
                    })
                    if (!response.ok) {
                        throw new Error('Failed to create new chat')
                    }
                    const data = await response.json()
                    setCurrentChatId(data.id)
                    router.replace(`/?chat=${data.id}`, { scroll: false })
                    await fetchAndSetChats()

                    // Wait for state updates to propagate
                    await new Promise(resolve => setTimeout(resolve, 100))

                    // Refresh the page to ensure proper initialization
                    window.location.reload()
                    return
                } catch (error) {
                    console.error('Error creating new chat:', error)
                    return
                }
            }

            // Only proceed with submit if we have a valid chatId
            console.log('Proceeding with submit for chat:', currentChatId)
            await handleSubmit(e)
            await fetchAndSetChats()
        } catch (error) {
            console.error('Error in submit:', error)
        }
    }, [currentChatId, session, handleSubmit, fetchAndSetChats, router])

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible((prev) => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [])

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
                                    messages={messages.map(msg => ({
                                        ...msg,
                                        createdAt: new Date(msg.createdAt || Date.now()),
                                        created_at: new Date(msg.createdAt || Date.now()),
                                        tool_calls: msg.toolInvocations ? [msg.toolInvocations] : undefined,
                                        tool_results: null
                                    } as ClientMessage))}
                                    input={input}
                                    handleInputChange={handleInputChangeWrapper}
                                    handleSubmit={handleSubmitWrapper}
                                    isLoading={isLoading}
                                    streamingMessage={streamingMessage}
                                    handleFileUpload={handleFileUpload}
                                    currentChatId={currentChatId}
                                    onChatSelect={handleChatSelect}
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
                                        className={`grid w-full ${csvFileName ? 'grid-cols-3' : 'grid-cols-2'} mb-4`}
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
                                    {csvFileName && (
                                        <TabsContent
                                            value="file"
                                            className="flex-grow"
                                        >
                                            <MetaSheet
                                                csvContent={csvContent}
                                            />
                                        </TabsContent>
                                    )}
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
                    \
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

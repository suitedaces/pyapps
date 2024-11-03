'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Chat } from '@/components/Chat'
import { CodeView } from '@/components/CodeView'
import LoginPage from '@/components/LoginPage'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useChat } from '@/hooks/useChat'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'

import { MetaSheet } from '@/components/MetaSheet'
import AppSidebar from '@/components/Sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

import { useAuth } from '@/contexts/AuthContext'
import { ClientMessage } from '@/lib/types'

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

export default function Home() {
    const router = useRouter()
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const resizableGroupRef = useRef<any>(null)
    const [sidebarChats, setSidebarChats] = useState<any[]>([])
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const [isInitializing, setIsInitializing] = useState(true)

    const { session, isLoading: isAuthLoading } = useAuth()

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
        console.log('Current URL:', window.location.search)

        const params = new URLSearchParams(window.location.search)
        const chatId = params.get('chat')

        console.log('Parsed chatId from URL:', chatId)

        if (chatId) {
            setCurrentChatId(chatId)
            console.log('Setting currentChatId to:', chatId)
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

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible((prev) => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [])

    const createInitialChat = useCallback(async () => {
        if (!session || isCreatingChat) return null

        setIsCreatingChat(true)
        try {
            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'New Chat' })
            })

            if (!response.ok) throw new Error('Failed to create chat')

            const data = await response.json()
            return data.id
        } catch (error) {
            console.error('Error creating chat:', error)
            return null
        } finally {
            setIsCreatingChat(false)
        }
    }, [session, isCreatingChat])

    const handleSubmitWrapper = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        console.log('Submit wrapper called, currentChatId:', currentChatId)

        if (!session || isAuthLoading) {
            console.log('No session or auth loading')
            return
        }

        try {
            // Always create a new chat if there isn't one
            if (!currentChatId) {
                console.log('Creating new chat...')
                const newChatId = await createInitialChat()
                if (!newChatId) {
                    console.error('Failed to create new chat')
                    return
                }

                // Update state and URL
                setCurrentChatId(newChatId)
                router.replace(`/?chat=${newChatId}`, { scroll: false })

                // Wait for state updates to propagate
                await new Promise(resolve => setTimeout(resolve, 100))

                // Refresh the page to ensure proper initialization
                window.location.reload()
                return
            }

            // Only proceed with submit if we have a valid chatId
            console.log('Proceeding with submit for chat:', currentChatId)
            await handleSubmit(e)
            await fetchAndSetChats()
        } catch (error) {
            console.error('Error in submit:', error)
        }
    }, [currentChatId, session, isAuthLoading, createInitialChat, handleSubmit, fetchAndSetChats, router])

    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div>Loading authentication...</div>
            </div>
        )
    }

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

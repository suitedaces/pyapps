'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'
import { Chat } from '@/components/Chat'
import LoginPage from '@/components/LoginPage'
import {
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Sidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { generateUUID } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query'
import { TypingText } from '@/components/core/typing-text'
import { Logo } from '@/components/core/Logo'
import { useSidebar } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'

export default function Home() {
    const router = useRouter()
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const { session, isLoading: isAuthLoading } = useAuth()
    const [showTypingText, setShowTypingText] = useState(true)

    // Fetch chats for sidebar
    const { data: sidebarChats, isLoading: isLoadingChats } = useQuery({
        queryKey: ['chats'],
        queryFn: async () => {
            if (!session) return []
            const response = await fetch('/api/conversations?page=1&limit=10')
            if (!response.ok) throw new Error('Failed to fetch chats')
            const data = await response.json()
            return data.chats
        },
        enabled: !!session,
    })

    // Handle chat creation callback
    const handleChatCreated = useCallback((chatId: string) => {
        setShowTypingText(false)
        setCurrentChatId(chatId)
        router.push(`/chat/${chatId}`)
    }, [router])

    // Handle chat selection
    const handleChatSelect = useCallback((chatId: string) => {
        setCurrentChatId(chatId)
        router.push(`/chat/${chatId}`)
    }, [router])

    // Handle new chat creation
    const handleNewChat = useCallback(async () => {
        setIsCreatingChat(true)
        try {
            const newChatId = generateUUID()
            handleChatCreated(newChatId)
        } finally {
            setIsCreatingChat(false)
        }
    }, [handleChatCreated])

    const handleChatSubmit = useCallback(() => {
        setShowTypingText(false)
    }, [])

    if (isAuthLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>
    }

    if (!session) {
        return <LoginPage />
    }

    return (
        <div className="flex h-screen">
            <div className="flex w-screen h-screen overflow-hidden">
                <Sidebar
                    onChatSelect={handleChatSelect}
                    onNewChat={handleNewChat}
                    currentChatId={currentChatId}
                    chats={sidebarChats || []}
                    isCreatingChat={isCreatingChat}
                    collapsed={sidebarCollapsed}
                    onCollapsedChange={setSidebarCollapsed}
                />
                <div className="flex-1 flex flex-col bg-white relative">
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
                        {showTypingText && (
                            <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
                                <TypingText
                                    text="From Data to App, in seconds."
                                    className="text-black font-semibold text-4xl whitespace-nowrap"
                                    show={showTypingText}
                                />
                            </div>
                        )}
                        <ResizablePanelGroup direction="horizontal">
                            <ResizablePanel defaultSize={65} minSize={45}>
                                <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                                    <Chat
                                        chatId={currentChatId}
                                        initialMessages={[]}
                                        onChatCreated={handleChatCreated}
                                        onChatSubmit={handleChatSubmit}
                                    />
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </main>
                </div>
            </div>
        </div>
    )
}

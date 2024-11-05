'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import { Chat } from '@/components/Chat'
import { CodeView } from '@/components/CodeView'
import LoginPage from '@/components/LoginPage'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { generateUUID } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query'

export default function Home() {
    const router = useRouter()
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const { session, isLoading: isAuthLoading } = useAuth()

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
        setCurrentChatId(chatId)
        window.history.replaceState(null, '', `/?chat=${chatId}`)
    }, [])

    // Handle chat selection
    const handleChatSelect = useCallback((chatId: string) => {
        setCurrentChatId(chatId)
        window.history.replaceState(null, '', `/?chat=${chatId}`)
    }, [])

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

    if (isAuthLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>
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
                chats={sidebarChats || []}
                isCreatingChat={isCreatingChat}
            />
            <div className="flex flex-col min-h-screen w-full bg-bg text-white overflow-x-hidden">
                <main className="flex-grow flex px-2 pr-9 flex-col mt-9 lg:flex-row overflow-hidden justify-center relative">
                    <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel defaultSize={65} minSize={45}>
                            <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                                <Chat
                                    chatId={currentChatId}
                                    initialMessages={[]}
                                    onChatCreated={handleChatCreated}
                                />
                            </div>
                        </ResizablePanel>

                        {/* Right panel components... */}
                    </ResizablePanelGroup>
                </main>
            </div>
        </SidebarProvider>
    )
}

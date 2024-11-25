'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'
import { Chat } from '@/components/Chat'
import LoginPage from '@/components/LoginPage'
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Sidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { TypingText } from '@/components/core/typing-text'
import { Logo } from '@/components/core/Logo'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StreamlitPreview } from '@/components/StreamlitPreview'

export default function Home() {
    const router = useRouter()
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const { session, isLoading: isAuthLoading } = useAuth()
    const [showTypingText, setShowTypingText] = useState(true)
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)

    const handleChatCreated = useCallback((chatId: string) => {
        setShowTypingText(false)
        setCurrentChatId(chatId)
        router.replace(`/chat/${chatId}`)
    }, [router])

    const handleChatSelect = useCallback((chatId: string) => {
        setShowTypingText(false)
        setCurrentChatId(chatId)
        router.replace(`/chat/${chatId}`)
    }, [router])

    const toggleRightContent = useCallback(() => {
        setShowTypingText(false)
        setIsRightContentVisible(prev => !prev)
    }, [])

    if (isAuthLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>
    }

    if (!session) {
        return <LoginPage />
    }

    return (
        <div className="relative flex h-screen overflow-hidden">
            <Sidebar
                onChatSelect={handleChatSelect}
                currentChatId={currentChatId}
                collapsed={sidebarCollapsed}
                onCollapsedChange={setSidebarCollapsed}
            />
            <div className={cn(
                "flex-1 flex flex-col bg-white min-w-0 transition-all duration-200",
                "relative"
            )}>
                {sidebarCollapsed && (
                    <div className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200" style={{ left: '4rem', right: 0 }}>
                        <div className="px-4">
                            <Logo inverted collapsed={false} />
                        </div>
                    </div>
                )}
                <main className={cn(
                    "flex-grow flex px-2 pr-9 flex-col lg:flex-row overflow-hidden justify-center relative",
                    "h-screen pt-14"
                )}>
                    {showTypingText && !currentChatId && (
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
                                    onChatCreated={handleChatCreated}
                                />
                            </div>
                        </ResizablePanel>

                        {isRightContentVisible && (
                            <ResizablePanel minSize={40} className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden rounded-xl bg-white h-[calc(100vh-4rem)] border border-gray-200">
                                <StreamlitPreview />
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
                        {isRightContentVisible ? (
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

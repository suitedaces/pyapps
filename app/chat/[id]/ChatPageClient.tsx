'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Playground } from '@/components/Playground'
import LoginPage from '@/components/LoginPage'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Message } from 'ai'
import { Sidebar } from '@/components/Sidebar'
import { Logo } from '@/components/core/Logo'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'

interface ChatPageClientProps {
    initialChat: any
}

export default function ChatPageClient({ initialChat }: ChatPageClientProps) {
    // Core state
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [currentChatId, setCurrentChatId] = useState<string | null>(initialChat.id)
    const [initialMessages, setInitialMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()
    const [activeTab, setActiveTab] = useState('preview')
    const [sidebarChats, setSidebarChats] = useState<any[]>([])

    // Refs
    const resizableGroupRef = useRef<any>(null)

    // Hooks
    const router = useRouter()
    const { id } = useParams()
    const { session, isLoading } = useAuth()

    // Fetch initial messages
    useEffect(() => {
        async function fetchMessages() {
            if (!id) return

            try {
                setLoading(true)
                const response = await fetch(`/api/conversations/${id}/messages`)
                if (!response.ok) throw new Error('Failed to fetch messages')
                const data = await response.json()

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

        fetchMessages()
    }, [id])

    // Fetch chats for sidebar
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

    // Handlers
    const handleChatSelect = useCallback((chatId: string) => {
        setCurrentChatId(chatId)
        router.replace(`/chat/${chatId}`, { scroll: false })
    }, [router])

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
            <div className={cn('flex-1 flex flex-col bg-white min-w-0 transition-all duration-200', 'relative')}>
                {sidebarCollapsed && (
                    <div className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200" style={{ left: '4rem', right: 0 }}>
                        <div className="px-4">
                            <Logo inverted collapsed={false} />
                        </div>
                    </div>
                )}
                <main className={cn('flex-grow flex px-2 pr-9 flex-col lg:flex-row overflow-hidden justify-center relative', 'h-screen pt-14')}>
                    <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                        <div className="mx-auto w-full h-full">
                            <Playground
                                chatId={currentChatId}
                                initialMessages={initialMessages}
                                onChatCreated={handleChatCreated}
                                setActiveTab={setActiveTab}
                                isRightContentVisible={isRightContentVisible}
                                setIsRightContentVisible={setIsRightContentVisible}
                                onCodeClick={() => {
                                    setActiveTab('code')
                                    setIsRightContentVisible(true)
                                }}
                            />
                        </div>
                    </div>
                    <div className="absolute top-2 right-4 z-30 flex justify-between items-center gap-4">
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

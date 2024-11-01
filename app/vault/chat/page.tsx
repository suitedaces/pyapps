'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessagesSquare, MoreVertical } from 'lucide-react'

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"

// Import pagination components
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import { SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from '@/components/Sidebar'

interface Chat {
    id: string
    name: string
    created_at: string
    last_message?: string
}

interface PaginatedResponse {
    chats: Chat[]
    total: number
}

const ITEMS_PER_PAGE = 15

export default function VaultChat() {
    const [chats, setChats] = useState<Chat[]>([])
    const [totalChats, setTotalChats] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [isCreatingChat, setIsCreatingChat] = useState(false)

    const router = useRouter()
    const searchParams = useSearchParams()
    const currentPage = Number(searchParams.get('page')) || 1

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery])

    // Fetch chats with search
    useEffect(() => {
        const fetchChats = async () => {
            try {
                setIsLoading(true)
                const response = await fetch(
                    `/api/conversations?page=${currentPage}&limit=${ITEMS_PER_PAGE}&search=${debouncedSearch}`
                )
                if (!response.ok) throw new Error('Failed to fetch chats')
                const data: PaginatedResponse = await response.json()
                setChats(data.chats)
                setTotalChats(data.total)
            } catch (error) {
                console.error('Error fetching chats:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchChats()
    }, [currentPage, debouncedSearch])

    // Reset to first page when search changes
    useEffect(() => {
        if (debouncedSearch) {
            router.push(createPageURL(1))
        }
    }, [debouncedSearch])

    // Handle chat selection
    const handleChatSelect = useCallback((chatId: string) => {
        setCurrentChatId(chatId)
        router.push(`/?chat=${chatId}`)
    }, [router])

    // Handle new chat creation
    const handleNewChat = useCallback(async () => {
        if (window.location.pathname !== '/') {
            router.push('/')
        }
        return Promise.resolve();
    }, [])

    const totalPages = Math.ceil(totalChats / ITEMS_PER_PAGE)

    const createPageURL = (pageNumber: number | string) => {
        const params = new URLSearchParams(searchParams)
        params.set('page', pageNumber.toString())
        return `?${params.toString()}`
    }

    const handleTabChange = (value: string) => {
        if (value === 'files') {
            router.push('/vault/files')
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar
                onChatSelect={handleChatSelect}
                onNewChat={handleNewChat}
                currentChatId={currentChatId}
                chats={chats}
                isCreatingChat={isCreatingChat}
            />
            <div className='p-7 h-screen w-full bg-bg'>
                <div className="flex flex-col h-full w-full border-2 border-border bg-bg overflow-hidden">
                    <div className="border-b border-gray-500 pt-5">
                        <div className="container flex gap-5 mx-auto px-4">
                            <h3 className="text-3xl font-semibold text-gray-800 py-2 mb-2">Vault</h3>
                            <Tabs defaultValue="chats" className="w-full" onValueChange={handleTabChange}>
                                <TabsList className="grid w-[400px] grid-cols-2 bg-gray-100">
                                    <TabsTrigger
                                        value="chats"
                                        className="data-[state=active]:bg-white"
                                    >
                                        Chats
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="files"
                                        className="data-[state=active]:bg-white"
                                    >
                                        Files
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>

                    <div className="container mx-auto px-4 py-4">
                        <Input
                            placeholder="Search for a chat..."
                            className="w-full bg-white border-gray-300 focus:border-gray-400 focus:ring-gray-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            <div className="container mx-auto px-4">
                                <div className="space-y-2 pb-4">
                                    {isLoading ? (
                                        // Loading skeleton
                                        Array.from({ length: 5 }).map((_, index) => (
                                            <div
                                                key={index}
                                                className="flex items-start gap-4 p-4 rounded-lg bg-[#F4F4F4] border border-gray-200 animate-pulse"
                                            >
                                                <div className="flex-shrink-0">
                                                    <div className="h-8 w-8 bg-bg rounded" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="h-4 w-1/4 bg-bg rounded mb-2" />
                                                    <div className="h-3 w-3/4 bg-bg rounded" />
                                                </div>
                                            </div>
                                        ))
                                    ) : chats.length > 0 ? (
                                        chats.map((chat) => (
                                            <div
                                                key={chat.id}
                                                className={`flex items-start gap-4 p-4 rounded-lg hover:bg-gray-100 cursor-pointer border border-gray-500 transition-colors ${currentChatId === chat.id ? 'bg-gray-50 border-gray-300' : ''
                                                    }`}
                                                onClick={() => handleChatSelect(chat.id)}
                                            >
                                                <div className="flex-shrink-0">
                                                    <MessagesSquare className="h-8 w-8 text-gray-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-sm font-medium text-gray-800 truncate">
                                                            {chat.name || `Chat ${chat.id.slice(0, 8)}`}
                                                        </h3>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(chat.created_at).toLocaleDateString()}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 hover:bg-gray-100"
                                                            >
                                                                <MoreVertical className="h-4 w-4 text-gray-500" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-500 truncate">
                                                        {chat.last_message || "No messages yet"}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
                                            No chats found
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-gray-500 py-4 bg-bg mt-auto">
                                <div className="container mx-auto px-4">
                                    <Pagination>
                                        <PaginationContent className="flex justify-center">
                                            <PaginationItem>
                                                <PaginationPrevious
                                                    href={createPageURL(currentPage - 1)}
                                                    className={`transition-opacity ${currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                                                />
                                            </PaginationItem>

                                            {[...Array(totalPages)].map((_, i) => {
                                                const page = i + 1

                                                if (
                                                    page === 1 ||
                                                    page === totalPages ||
                                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <PaginationItem key={page}>
                                                            <PaginationLink
                                                                href={createPageURL(page)}
                                                                isActive={page === currentPage}
                                                            >
                                                                {page}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    )
                                                }

                                                if (
                                                    page === currentPage - 2 ||
                                                    page === currentPage + 2
                                                ) {
                                                    return (
                                                        <PaginationItem key={page}>
                                                            <PaginationEllipsis className='text-black' />
                                                        </PaginationItem>
                                                    )
                                                }

                                                return null
                                            })}

                                            <PaginationItem>
                                                <PaginationNext
                                                    href={createPageURL(currentPage + 1)}
                                                    className={`transition-opacity ${currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
                                                />
                                            </PaginationItem>
                                        </PaginationContent>
                                    </Pagination>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </SidebarProvider>
    )
}

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { PlusCircle, Settings, SidebarIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface SidebarProps {
    isRightContentVisible: boolean
    setIsRightContentVisible: (isVisible: boolean) => void
    onChatSelect: (chatId: string) => void
    onNewChat: () => Promise<void>
    currentChatId: string | null
}

interface Chat {
    id: string
    name: string | null
}

export default function Sidebar({
    isRightContentVisible,
    setIsRightContentVisible,
    onChatSelect,
    onNewChat,
    currentChatId,
}: SidebarProps, id: string) {
    const [isOpen, setIsOpen] = useState(false)
    const [chats, setChats] = useState<Chat[]>([])
    const [isNewChat, setIsNewChat] = useState(false);


    const router = useRouter()

    const toggleSidebar = () => {
        const sIsOpen = !isOpen
        setIsOpen(sIsOpen)
        setIsRightContentVisible(!sIsOpen)
    }

    useEffect(() => {
        fetchChats()
    }, [])


    const fetchChats = async () => {
        try {
            const response = await fetch('/api/conversations')
            if (!response.ok) {
                throw new Error('Failed to fetch chats')
            }
            const data = await response.json()
            setChats(data)

            console.log(data);

        } catch (error) {
            console.error('Error fetching chats:', error)
        }
    }

    const handleNewChat = async () => {
        setIsNewChat(true)
        await onNewChat()
        fetchChats() // refresh the chat list
    }

    const handleChatSelect = (chatId: string) => {
        setIsNewChat(false)
        onChatSelect(chatId)
    }

    const sidebarVariants = {
        open: { x: 0 },
        closed: { x: '-100%' },
    }

    return (
        <div className="relative">
            <Button
                onClick={toggleSidebar}
                className="fixed top-4 left-4 z-30"
                size="icon"
            >
                <SidebarIcon className="h-4 w-4" />
                <span className="sr-only">Toggle Sidebar</span>
            </Button>

            <motion.div
                initial="closed"
                animate={isOpen ? 'open' : 'closed'}
                variants={sidebarVariants}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="fixed left-0 top-0 bottom-0 w-64 bg-matte text-white p-4 z-20"
            >
                <div className="flex relative flex-col h-full">
                    <Button
                        onClick={handleNewChat}
                        className="absolute right-0 top-0"
                    >
                        <PlusCircle className="h-4 w-4" />
                    </Button>

                    <div className="flex-grow mt-20 overflow-auto">
                        {chats.map((chat) => (
                            <Link href={`/chat/${chat.id}`} key={chat.id}>
                                <Button
                                    key={chat.id}
                                    onClick={() => onChatSelect(chat.id)}
                                    className={`w-full text-left py-2 px-3 mb-1 rounded-lg hover:bg-gray-700 transition-colors ${currentChatId === chat.id
                                        ? 'bg-gray-700'
                                        : ''
                                        }`}
                                >
                                    NEW CHAT

                                </Button>
                            </Link>
                        ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/20">
                        <Button className="w-full justify-start text-text">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

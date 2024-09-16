'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { PlusCircle, Settings, SidebarIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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
}: SidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [chats, setChats] = useState<Chat[]>([])
    const [newChatButtonText, setNewChatButtonText] = useState('New Chat')
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
        } catch (error) {
            console.error('Error fetching chats:', error)
        }
    }

    const generateChatName = async (): Promise<string> => {
        try {
            const response = await fetch('/api/generate-chat-name', {
                method: 'POST',
            })
            if (!response.ok) {
                throw new Error('Failed to generate chat name')
            }
            const data = await response.json()
            return data.name
        } catch (error) {
            console.error('Error generating chat name:', error)
            return 'New Chat'
        }
    }

    const handleNewChat = async () => {
        try {
            const chatName = await generateChatName()
            setNewChatButtonText(chatName)
            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: chatName }),
            })
            if (!response.ok) {
                throw new Error('Failed to create new chat')
            }
            const newChat = await response.json()
            router.push(`/chat/${newChat.id}`)
            fetchChats()
            // Reset the button text after a short delay
            setTimeout(() => setNewChatButtonText('New Chat'), 3000)
        } catch (error) {
            console.error('Error creating new chat:', error)
            setNewChatButtonText('New Chat')
        }
    }

    const sidebarVariants = {
        open: { x: 0 },
        closed: { x: '-100%' },
    }

    return (
        <div className="relative">
            <Button
                onClick={toggleSidebar}
                className="fixed top-2 left-4 z-30"
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
                <div className="flex flex-col h-full">
                    <Button
                        onClick={handleNewChat}
                        className="mb-4 w-full justify-start"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {newChatButtonText}
                    </Button>

                    <div className="flex-grow mt-20 overflow-auto">
                        {chats.map((chat) => (
                            <Link href={`/chat/${chat.id}`} key={chat.id}>
                                <Button
                                    className={`w-full text-left py-2 px-3 mb-1 rounded-lg hover:bg-gray-700 transition-colors ${
                                        currentChatId === chat.id
                                            ? 'bg-gray-700'
                                            : ''
                                    }`}
                                >
                                    {chat.name || `Chat ${chat.id.slice(0, 8)}`}
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

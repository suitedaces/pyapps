'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'


import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, Settings, SidebarIcon, MoreHorizontal, Trash2, Edit2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip"

import { Input } from "@/components/ui/input"

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
    const [chatToDelete, setChatToDelete] = useState<string | null>(null)

    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
    const [chatToRename, setChatToRename] = useState<Chat | null>(null)
    const [newChatName, setNewChatName] = useState('')

    const router = useRouter()
    const supabase = createClientComponentClient()


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
        fetchChats()
    }

    const handleDeleteChat = async (chatId: string) => {
        try {
            const { error } = await supabase
                .from('chats')
                .delete()
                .eq('id', chatId)

            if (error) throw error

            setChats(prevChats => prevChats.filter(chat => chat.id !== chatId))

            // always navigate to home after deletion
            router.push('/')

            // go to home, if the current one deleted
            if (chatId === currentChatId) {
                onChatSelect('')
            }

            setChatToDelete(null)
        } catch (error) {
            console.error('Error deleting chat:', error)
        }
    }

    const handleClearAllChats = () => {
        // client side for now
        setChats([])
        // if there's a current chat selected, clear it
        if (currentChatId) {
            onChatSelect('')
        }
    }


    const handleRenameChat = (chat: Chat) => {
        setChatToRename(chat)
        setNewChatName(chat.name || '')
        setIsRenameDialogOpen(true)
    }

    const confirmRenameChat = async () => {
        if (chatToRename) {
            try {
                const { data, error } = await supabase
                    .from('chats')
                    .update({ name: newChatName })
                    .eq('id', chatToRename.id)
                    .select()

                if (error) throw error

                // Update local state
                setChats(chats.map(chat =>
                    chat.id === chatToRename.id ? { ...chat, name: newChatName } : chat
                ))

                setIsRenameDialogOpen(false)
                setChatToRename(null)
                setNewChatName('')
            } catch (error) {
                console.error('Error renaming chat:', error)
            }
        }
    }

    const sidebarVariants = {
        open: { x: 0 },
        closed: { x: '-100%' },
    }

    const chatItemVariants = {
        hidden: { opacity: 0, height: 0, marginBottom: 0 },
        visible: { opacity: 1, height: 'auto', marginBottom: 4 },
        exit: { opacity: 0, height: 0, marginBottom: 0 }
    }

    return (
        <div className="relative">
            <Button
                onClick={toggleSidebar}
                className="fixed top-2 left-2 z-30"
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
                <div className="relative flex flex-col h-full">
                    <Button
                        onClick={handleNewChat}
                        className="absolute right-0 top-0"
                    >
                        <PlusCircle className="h-4 w-4" />
                    </Button>
                    <div className="flex-grow mt-20 overflow-auto">
                        <AnimatePresence>
                            {chats.map((chat) => (
                                <motion.div
                                    key={chat.id}
                                    variants={chatItemVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    layout
                                    className="mb-1 relative group"
                                >
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant={'noShadow'}
                                                    size="sm"
                                                    onClick={() => onChatSelect(chat.id)}
                                                    className={`w-full text-left px-3 rounded-lg hover:bg-white hover:transform-none transition-colors ${currentChatId === chat.id ? 'bg-white' : ''}`}
                                                >
                                                    <span className="flex-grow truncate">
                                                        {chat.name || `Chat ${chat.id.slice(0, 8)}`}
                                                    </span>
                                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-0.5 bg-white rounded-md overflow-hidden">
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRenameChat(chat);
                                                            }}
                                                            size="xsm"
                                                            variant="wBg"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                            <span className="sr-only">Rename Chat</span>
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    size="xsm"
                                                                    variant="wBg"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    <span className="sr-only">Delete Chat</span>
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This action cannot be undone. This will permanently delete your chat.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteChat(chat.id)}>
                                                                        Confirm
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{chat.name || `Chat ${chat.id.slice(0, 8)}`}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/20">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="w-full justify-start text-text">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Settings
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="w-52" onSelect={(e: any) => e.preventDefault()}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Clear All Chats
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Clear All Chats</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to clear all chats? This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleClearAllChats}>
                                                Confirm
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </motion.div>

            <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Chat</DialogTitle>
                        <DialogDescription>
                            Enter a new name for the chat.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={newChatName}
                        onChange={(e) => setNewChatName(e.target.value)}
                        placeholder="Enter new chat name"
                    />
                    <DialogFooter>
                        <Button variant="neutral" onClick={() => setIsRenameDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={confirmRenameChat}>
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

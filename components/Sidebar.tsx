'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import {
    BadgeCheck,
    Bell,
    ChevronRight,
    ChevronsUpDown,
    CreditCard,
    File,
    Folder,
    LogOut,
    MessageSquare,
    MoreHorizontal,
    MoveRight,
    Origami,
    Plus,
    Share,
    Sparkles,
    Trash2,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
    useSidebar,
} from '@/components/ui/sidebar'

import LoadingSpinner from './LoadingSpinner'

import { BorderTrail } from '@/components/core/border-trail'

interface Chat {
    id: string
    name: string
    created_at: string
    last_message?: string
}

interface SidebarProps {
    onChatSelect: (chatId: string) => void
    onNewChat: () => void
    currentChatId: string | null
    chats?: Chat[]
    isCreatingChat: boolean
}

const data = {
    user: {
        name: 'shadcn',
        email: 'm@example.com',
        avatar: '/avatars/shadcn.jpg',
    },
    chats: [] as Chat[],
}

const Spinner = () => {
    return (
        <div className="flex justify-center pb-80 h-screen ">
            <LoadingSpinner />
        </div>
    )
}

interface CustomSidebarMenuSubItemProps {
    isActive?: boolean
    children: React.ReactNode
    className?: string
}

const CustomSidebarMenuSubItem = ({
    isActive,
    children,
    className,
}: CustomSidebarMenuSubItemProps) => (
    <div className={`${className} ${isActive ? 'bg-accent/50' : 'bg-background hover:bg-accent/30'}`}>
        {children}
    </div>
)

const TypewriterText = ({ text }: { text: string }) => {
    return (
        <motion.span
            initial={{ opacity: 0 }}
            animate={{
                opacity: 1,
                transition: {
                    duration: 0.2,
                },
            }}
        >
            {text.split('').map((char, index) => (
                <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                        duration: 0.1,
                        delay: index * 0.05,
                        ease: 'easeInOut',
                    }}
                >
                    {char}
                </motion.span>
            ))}
        </motion.span>
    )
}

const ChatsList = ({
    chats = [],
    onChatSelect,
    currentChatId,
    isCreatingChat,
}: {
    chats: Chat[]
    onChatSelect: (chatId: string) => void
    currentChatId: string | null
    isCreatingChat: boolean
}) => {
    const router = useRouter()
    const visibleChats = chats.slice(0, 10)

    // Get the most recent chat title
    const mostRecentChat = chats[0]?.name || 'New Chat'

    return (
        <SidebarMenuSub>
            <AnimatePresence>
                {isCreatingChat && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                    >
                        <CustomSidebarMenuSubItem className="group/item relative bg-sidebar-accent">
                            <SidebarMenuSubButton className="w-full text-left flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 animate-pulse" />
                                <TypewriterText text={mostRecentChat} />
                                <span className="ml-2 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            </SidebarMenuSubButton>
                        </CustomSidebarMenuSubItem>
                    </motion.div>
                )}

                {visibleChats.map((chat, index) => (
                    <motion.div
                        key={chat.id}
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{
                            duration: 0.3,
                            delay: index * 0.1,
                            type: 'spring',
                            stiffness: 200,
                            damping: 20,
                        }}
                    >
                        <CustomSidebarMenuSubItem
                            className={`group/item relative ${
                                currentChatId === chat.id ? 'bg-accent/50' : 'bg-background hover:bg-accent/30'
                            }`}
                        >
                            <SidebarMenuSubButton
                                className="w-full text-left flex items-center gap-2"
                                onClick={() => onChatSelect(chat.id)}
                            >
                                <MessageSquare className="h-4 w-4" />
                                <span className="truncate">
                                    {chat.name || `Chat ${chat.id.slice(0, 8)}`}
                                </span>
                            </SidebarMenuSubButton>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuAction className="invisible absolute right-2 top-1/2 -translate-y-1/2 group-hover/item:visible">
                                        <MoreHorizontal />
                                        <span className="sr-only">More</span>
                                    </SidebarMenuAction>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-48"
                                    side="right"
                                    align="start"
                                >
                                    <DropdownMenuItem>
                                        <Folder className="text-muted-foreground" />
                                        <span>View Project</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <Share className="text-muted-foreground" />
                                        <span>Share Project</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <Trash2 className="text-muted-foreground" />
                                        <span>Delete Project</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CustomSidebarMenuSubItem>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* View All Button - Always show if there are any chats */}
            {chats.length > 0 && (
                <CustomSidebarMenuSubItem className="group/item relative hover:underline mt-2">
                    <SidebarMenuSubButton
                        className="w-full cursor-pointer text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1 text-sm pl-2"
                        onClick={() => router.push('/vault/chat')}
                    >
                        View all
                        <MoveRight className="h-3 w-3" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            )}
        </SidebarMenuSub>
    )
}

export default function AppSidebar({
    onChatSelect,
    onNewChat,
    currentChatId,
    chats = [],
    isCreatingChat,
}: SidebarProps) {
    const [open, setOpen] = useState(false)
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
    const [chatToRename, setChatToRename] = useState<Chat | null>(null)
    const [newChatName, setNewChatName] = useState('')
    const [isNewChat, setIsNewChat] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClientComponentClient()
    const router = useRouter()

    const { state, openMobile, setOpenMobile, isMobile, toggleSidebar } =
        useSidebar()

    // Add isOpen state
    const [isChatsOpen, setIsChatsOpen] = useState(true)

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

    // Handling Chat

    const handleNewChat = async () => {
        router.push('/chat')
    }

    const handleChatSelect = (chatId: string) => {
        // Redirect to chat page using window.location
        router.push(`/chat/${chatId}`)
    }

    // Add sign out handler
    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <SidebarProvider open={open} onOpenChange={setOpen}>
            <Sidebar variant="sidebar" collapsible="icon">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem className="flex justify-between">
                            <a href="#">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                    <Origami className="size-4" />
                                </div>
                            </a>
                            {open && <SidebarTrigger className="ml-auto" />}
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    onClick={handleNewChat}
                                    className="w-full justify-center bg-background border border-border hover:bg-accent"
                                >
                                    <BorderTrail
                                        className="bg-gradient-to-l from-gray-200 via-black to-gray-200 dark:from-gray-700 dark:via-black dark:to-gray-700"
                                        size={36}
                                    />
                                    {!open && <Plus />}
                                    <span className="group-data-[collapsible=icon]:hidden text-center">
                                        New Chat
                                    </span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>
                    {/* <SidebarGroup className="group-data-[collapsible=icon]:hidden"> */}
                    <SidebarGroup>
                        <SidebarGroupLabel>Hub</SidebarGroupLabel>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild>
                                    <Link href="/vault/files">
                                        <File />
                                        <span>Files</span>
                                    </Link>
                                </SidebarMenuButton>
                                {/* <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <SidebarMenuAction showOnHover>
                                                <MoreHorizontal />
                                                <span className="sr-only">More</span>
                                            </SidebarMenuAction>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            className="w-48"
                                            side="right"
                                            align="start"
                                        >
                                            <DropdownMenuItem>
                                                <Folder className="text-muted-foreground" />
                                                <span>View Project</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <Share className="text-muted-foreground" />
                                                <span>Share Project</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem>
                                                <Trash2 className="text-muted-foreground" />
                                                <span>Delete Project</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu> */}
                            </SidebarMenuItem>
                        </SidebarMenu>
                        <SidebarMenu>
                            <Collapsible
                                defaultOpen
                                className="group/collapsible"
                                open={isChatsOpen}
                                onOpenChange={setIsChatsOpen}
                            >
                                <SidebarMenuItem>
                                    <SidebarMenuButton>
                                        <MessageSquare />
                                        <span>Chats</span>
                                    </SidebarMenuButton>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuAction
                                            className={`transition-transform duration-200 ${isChatsOpen ? 'rotate-90' : ''}`}
                                        >
                                            <ChevronRight />
                                        </SidebarMenuAction>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <Suspense fallback={<Spinner />}>
                                            <ChatsList
                                                chats={chats}
                                                onChatSelect={handleChatSelect}
                                                currentChatId={currentChatId}
                                                isCreatingChat={isCreatingChat}
                                            />
                                        </Suspense>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        </SidebarMenu>
                    </SidebarGroup>
                    <SidebarGroup className="mt-auto">
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {!open && (
                                    <SidebarMenuItem>
                                        <SidebarMenuButton>
                                            <SidebarTrigger className="w-4 h-4" />
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton
                                        size="lg"
                                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                    >
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            <AvatarImage
                                                src={
                                                    session?.user?.user_metadata
                                                        ?.avatar_url ||
                                                    '/default-avatar.png'
                                                }
                                                alt={
                                                    session?.user?.user_metadata
                                                        ?.full_name || 'User'
                                                }
                                            />
                                            <AvatarFallback className="rounded-lg">
                                                {session?.user?.user_metadata
                                                    ?.full_name?.[0] || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">
                                                {session?.user?.user_metadata
                                                    ?.full_name || 'Guest User'}
                                            </span>
                                            <span className="truncate text-xs">
                                                {session?.user?.email ||
                                                    'Not signed in'}
                                            </span>
                                        </div>
                                        <ChevronsUpDown className="ml-auto size-4" />
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                                    side="bottom"
                                    align="end"
                                    sideOffset={4}
                                >
                                    <DropdownMenuLabel className="p-0 font-normal">
                                        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                            <Avatar className="h-8 w-8 rounded-lg">
                                                <AvatarImage
                                                    src={
                                                        session?.user
                                                            ?.user_metadata
                                                            ?.avatar_url ||
                                                        '/default-avatar.png'
                                                    }
                                                    alt={
                                                        session?.user
                                                            ?.user_metadata
                                                            ?.full_name ||
                                                        'User'
                                                    }
                                                />
                                                <AvatarFallback className="rounded-lg">
                                                    CN
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-semibold">
                                                    {session?.user
                                                        ?.user_metadata
                                                        ?.full_name ||
                                                        'Guest User'}
                                                </span>
                                                <span className="truncate text-xs">
                                                    {session?.user?.email ||
                                                        'Not signed in'}
                                                </span>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem>
                                            <Sparkles />
                                            Upgrade to Pro
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem>
                                            <BadgeCheck />
                                            Account
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <CreditCard />
                                            Billing
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <Bell />
                                            Notifications
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleSignOut}>
                                        <LogOut />
                                        Log out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
        </SidebarProvider>
    )
}

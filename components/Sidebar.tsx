"use client"

import { useState, useEffect, Suspense } from "react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'

import {
    BadgeCheck,
    Bell,
    BookOpen,
    Bot,
    ChevronRight,
    ChevronsUpDown,
    Origami,
    CreditCard,
    Folder,
    Frame,
    LifeBuoy,
    LogOut,
    File,
    Map,
    MoreHorizontal,
    PieChart,
    Send,
    Settings2,
    Share,
    Sparkles,
    SquareTerminal,
    Trash2,
    MessageSquare,
    Edit2,
    Plus,
} from "lucide-react"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
    useSidebar,
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
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarTrigger,
    SidebarRail,
} from "@/components/ui/sidebar"

import { Input } from '@/components/ui/input'

import LoadingSpinner from './LoadingSpinner'

import { BorderTrail } from '@/components/core/border-trail';



interface Chat {
    id: string
    name: string | null
    created_at?: string
}

interface SidebarProps {
    onChatSelect: (chatId: string) => void
    onNewChat: () => Promise<void>
}

const INITIAL_LOAD = 11
const LOAD_MORE_COUNT = 5

const data = {
    user: {
        name: "shadcn",
        email: "m@example.com",
        avatar: "/avatars/shadcn.jpg",
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

const ChatsList = ({
    chats = [],
    onChatSelect,
    isLoadingMore,
}: {
    chats: Chat[],
    onChatSelect: (chatId: string) => void,
    isLoadingMore: boolean
}) => {
    if (!chats) return null;

    const [displayCount, setDisplayCount] = useState(INITIAL_LOAD)

    // Only show the number of chats based on displayCount
    const visibleChats = chats.slice(0, displayCount)
    const hasMoreToShow = chats.length > displayCount

    return (
        <SidebarMenuSub className="w-full">
            {visibleChats.map((chat) => (
                <SidebarMenuSubItem
                    key={chat.id}
                    className="group/item relative hover:bg-white"
                >
                    <SidebarMenuSubButton
                        className="hover:bg-accent/50 w-11/12 cursor-pointer"
                        onClick={() => onChatSelect(chat.id)}
                    >
                        <span>{chat.name || `Chat ${chat.id.slice(0, 8)}`}</span>
                    </SidebarMenuSubButton>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuAction
                                className="invisible absolute right-2 top-1/2 -translate-y-1/2 group-hover/item:visible">
                                <MoreHorizontal />
                                <span className="sr-only">More</span>
                            </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48" side="right" align="start"
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
                </SidebarMenuSubItem>
            ))}

            {hasMoreToShow && (
                <SidebarMenuSubItem className="justify-center">
                    <SidebarMenuButton
                        onClick={() => setDisplayCount(prev => prev + LOAD_MORE_COUNT)}
                        className="w-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 rounded-md flex items-center justify-center gap-2 border-border border"
                    >
                        {isLoadingMore ? (
                            <>
                                <LoadingSpinner />
                                <span>Loading...</span>
                            </>
                        ) : (
                            <span>Load More</span>
                        )}
                    </SidebarMenuButton>
                </SidebarMenuSubItem>
            )}
        </SidebarMenuSub>
    )
}

export default function AppSidebar({
    onChatSelect,
    onNewChat,
}: SidebarProps,
    id: string
) {
    const [open, setOpen] = useState(false)
    const [chats, setChats] = useState<Chat[]>([])
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
    const [chatToRename, setChatToRename] = useState<Chat | null>(null)
    const [newChatName, setNewChatName] = useState('')
    const [isNewChat, setIsNewChat] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClientComponentClient()

    const [hasMore, setHasMore] = useState(true)
    const [nextCursor, setNextCursor] = useState<string | undefined>()
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const CHATS_PER_PAGE = 11

    const {
        state,
        openMobile,
        setOpenMobile,
        isMobile,
        toggleSidebar,
    } = useSidebar()

    console.log({
        state,
        open,
        isMobile
    });

    useEffect(() => {
        fetchChats()
    }, [])

    const fetchChats = async () => {
        try {
            const response = await fetch('/api/conversations')
            if (response.ok) {
                const data = await response.json()
                setChats(data)
            }
        } catch (error) {
            console.error('Error fetching chats:', error)
        }
    }

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
        setIsNewChat(true)
        await onNewChat()
        fetchChats()
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
                            {open && (
                                <SidebarTrigger className="ml-auto" />
                            )}
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={handleNewChat} className="w-full justify-center border border-gray-300">
                                    <BorderTrail
                                        className='bg-gradient-to-l from-gray-200 via-black to-gray-200 dark:from-gray-700 dark:via-black dark:to-gray-700'
                                        size={36}
                                    />
                                    {!open && (
                                        <Plus />
                                    )}
                                    <span className="group-data-[collapsible=icon]:hidden text-center">New Chat</span>
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
                                    <a href="#">
                                        <File />
                                        <span>Files</span>
                                    </a>
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
                                        <SidebarMenuAction className={`transition-transform duration-200 ${isChatsOpen ? 'rotate-90' : ''}`}>
                                            <ChevronRight />
                                        </SidebarMenuAction>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <Suspense fallback={<Spinner />}>
                                            <ChatsList
                                                chats={chats}
                                                onChatSelect={onChatSelect}
                                                isLoadingMore={isLoadingMore}
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
                                                src={session?.user?.user_metadata?.avatar_url || '/default-avatar.png'}
                                                alt={session?.user?.user_metadata?.full_name || 'User'}
                                            />
                                            <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">
                                                {session?.user?.user_metadata?.full_name || 'Guest User'}
                                            </span>
                                            <span className="truncate text-xs">
                                                {session?.user?.email || 'Not signed in'}
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
                                                    src={session?.user?.user_metadata?.avatar_url || '/default-avatar.png'}
                                                    alt={session?.user?.user_metadata?.full_name || 'User'}
                                                />
                                                <AvatarFallback className="rounded-lg">
                                                    CN
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-semibold">
                                                    {session?.user?.user_metadata?.full_name || 'Guest User'}
                                                </span>
                                                <span className="truncate text-xs">
                                                    {session?.user?.email || 'Not signed in'}
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
                                    <DropdownMenuItem>
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

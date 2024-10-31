"use client"

import { useState, useEffect, Suspense } from "react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { useRouter } from "next/navigation"
import Link from 'next/link'

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
    MoveRight,
    MessagesSquare,
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
    id: string;
    name: string;
    created_at: string;
    last_message?: string;
}

interface SidebarProps {
    onChatSelect: (chatId: string) => void;
    onNewChat: () => void;
    currentChatId: string | null;
    chats?: Chat[];
}

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

interface CustomSidebarMenuSubItemProps {
    isActive?: boolean;
    children: React.ReactNode;
    className?: string;
}

const CustomSidebarMenuSubItem = ({ isActive, children, className }: CustomSidebarMenuSubItemProps) => (
    <div className={`${className} ${isActive ? 'bg-white/50' : ''}`}>
        {children}
    </div>
)

const ChatsList = ({
    chats = [],
    onChatSelect,
    currentChatId,
}: {
    chats: Chat[],
    onChatSelect: (chatId: string) => void,
    currentChatId: string | null
}) => {
    const router = useRouter()
    const visibleChats = chats.slice(0, 10)
    const hasMoreChats = chats.length > 10

    return (
        <SidebarMenuSub>
            {visibleChats.map((chat) => (
                <CustomSidebarMenuSubItem
                    key={chat.id}
                    className={`group/item relative ${currentChatId === chat.id ? 'bg-sidebar-accent' : ''}`}
                >
                    <SidebarMenuSubButton
                        className="w-full text-left flex items-center gap-2"
                        onClick={() => onChatSelect(chat.id)}
                    >
                        <MessageSquare className="h-4 w-4" />
                        <span className="truncate">{chat.name || `Chat ${chat.id.slice(0, 8)}`}</span>
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
                </CustomSidebarMenuSubItem>
            ))}

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
    chats = []
}: SidebarProps) {
    const [open, setOpen] = useState(false)
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
    const [chatToRename, setChatToRename] = useState<Chat | null>(null)
    const [newChatName, setNewChatName] = useState('')
    const [isNewChat, setIsNewChat] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClientComponentClient()
    const router = useRouter()

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
        router.push('/chat')
    }

    const handleChatSelect = (chatId: string) => {
        // Redirect to chat page using window.location
        window.location.href = `/chat/${chatId}`;
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
                                <SidebarMenuButton
                                    onClick={handleNewChat}
                                    className="w-full justify-center border border-gray-300"
                                >
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
                                        <SidebarMenuAction className={`transition-transform duration-200 ${isChatsOpen ? 'rotate-90' : ''}`}>
                                            <ChevronRight />
                                        </SidebarMenuAction>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <Suspense fallback={<Spinner />}>
                                            <ChatsList
                                                chats={chats}
                                                onChatSelect={handleChatSelect}
                                                currentChatId={currentChatId}
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
                                            <AvatarFallback className="rounded-lg">
                                                {session?.user?.user_metadata?.full_name?.[0] || 'U'}
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

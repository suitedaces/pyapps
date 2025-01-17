'use client'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Session } from '@supabase/supabase-js'
import { FileData, AppData } from '@/lib/types'
import {
    AppWindow,
    BadgeCheck,
    ChevronRight,
    ChevronsUpDown,
    CreditCard,
    File,
    LogOut,
    Menu,
    MessageSquare,
    MoveRight,
    Plus,
    Sparkles,
    Trash2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
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
    SidebarSeparator,
    SidebarTrigger,
} from '@/components/ui/sidebar'

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
} from '@/components/ui/alert-dialog'
import { ThemeSwitcherButton } from '@/components/ui/theme-button-switcher'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from './core/Logo'

interface Chat {
    id: string
    name: string
    created_at: string
    last_message?: string
}

interface SidebarProps {
    onChatSelect: (chatId: string) => void
    currentChatId: string | null
    chats?: Chat[]
    isCreatingChat: boolean
    chatTitles: Record<string, string>
    onGenerateTitle: (chatId: string) => Promise<string | null>
    onChatDeleted: () => void
}

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

const CustomSidebarMenuSubItem = ({
    isActive,
    children,
    className,
}: {
    isActive?: boolean
    children: React.ReactNode
    className?: string
}) => (
    <div
        className={`${className} ${isActive ? 'bg-accent/50' : 'bg-background hover:bg-accent/30'}`}
    >
        {children}
    </div>
)

interface ChatsListProps {
    chats: Chat[]
    onChatSelect: (chatId: string) => void
    currentChatId: string | null
    isCreatingChat: boolean
    chatTitles: Record<string, string>
    onGenerateTitle: (chatId: string) => Promise<string | null>
    onChatDeleted: () => void
}

const ChatsList = ({
    chats = [],
    onChatSelect,
    currentChatId,
    isCreatingChat,
    chatTitles,
    onGenerateTitle,
    onChatDeleted,
}: ChatsListProps) => {
    const router = useRouter()
    const visibleChats = chats.slice(0, 10)

    useEffect(() => {
        const generateMissingTitles = async () => {
            console.log('🔍 Checking for chats without titles...')
            for (const chat of chats) {
                if (!chat.name && !chatTitles[chat.id]) {
                    console.log('📝 Requesting title for chat:', chat.id)
                    await onGenerateTitle(chat.id)
                }
            }
        }

        generateMissingTitles()
    }, [chats, chatTitles, onGenerateTitle])

    const getChatTitle = (chat: Chat) => {
        return chat.name || chatTitles[chat.id] || 'New Project'
    }

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
                                <TypewriterText text={getChatTitle(chats[0])} />
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
                            className={`group/item relative`}
                            isActive={currentChatId === chat.id}
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

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="invisible absolute right-2 top-1/2 -translate-y-1/2 group-hover/item:visible h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-[400px]">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-semibold text-foreground">
                                            Delete Project
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-muted-foreground/80 pt-2">
                                            Are you sure you want to delete this
                                            project? This action cannot be
                                            undone and will permanently delete
                                            all associated data.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-4 gap-2">
                                        <AlertDialogCancel className="border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={async () => {
                                                try {
                                                    const response =
                                                        await fetch(
                                                            `/api/chats/${chat.id}`,
                                                            {
                                                                method: 'DELETE',
                                                            }
                                                        )

                                                    if (!response.ok) {
                                                        throw new Error(
                                                            'Failed to delete chat'
                                                        )
                                                    }

                                                    onChatDeleted()

                                                    if (
                                                        currentChatId ===
                                                        chat.id
                                                    ) {
                                                        router.push('/')
                                                    }
                                                } catch (error) {
                                                    console.error(
                                                        'Failed to delete chat:',
                                                        error
                                                    )
                                                }
                                            }}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-red-600 dark:text-white dark:hover:bg-red-700 transition-colors"
                                        >
                                            Delete Project
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CustomSidebarMenuSubItem>
                    </motion.div>
                ))}
            </AnimatePresence>

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

const FilesList = () => {
    const [files, setFiles] = useState<FileData[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()
    const { session } = useAuth()

    useEffect(() => {
        const fetchFiles = async () => {
            if (!session?.user?.id) return
            
            try {
                const { data, error } = await supabase
                    .from('files')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('updated_at', { ascending: false })
                    .limit(3)

                if (error) throw error

                const mappedFiles = data.map(file => ({
                    id: file.id,
                    name: file.file_name,
                    type: file.file_type,
                    updated_at: file.updated_at
                }))
                setFiles(mappedFiles)
            } catch (error) {
                console.error('Error fetching files:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchFiles()
    }, [supabase, session?.user?.id])

    if (loading) {
        return (
            <SidebarMenuSub>
                <CustomSidebarMenuSubItem>
                    <SidebarMenuSubButton className="w-full text-left flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                        <div className="h-4 w-24 animate-pulse bg-muted rounded" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            </SidebarMenuSub>
        )
    }

    return (
        <SidebarMenuSub>
            {files.map((file) => (
                <CustomSidebarMenuSubItem key={file.id}>
                    <SidebarMenuSubButton
                        className="w-full text-left flex items-center gap-2"
                        onClick={() => router.push(`/files/${file.id}`)}
                    >
                        <File className="h-4 w-4" />
                        <span className="truncate">{file.name}</span>
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            ))}
            {files.length > 0 && (
                <CustomSidebarMenuSubItem className="group/item relative hover:underline mt-2">
                    <SidebarMenuSubButton
                        className="w-full cursor-pointer text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1 text-sm pl-2"
                        onClick={() => router.push('/files')}
                    >
                        View all
                        <MoveRight className="h-3 w-3" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            )}
        </SidebarMenuSub>
    )
}

const AppsList = () => {
    const [apps, setApps] = useState<AppData[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()
    const { session } = useAuth()

    useEffect(() => {
        const fetchApps = async () => {
            if (!session?.user?.id) return
            
            try {
                const { data, error } = await supabase
                    .from('apps')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('updated_at', { ascending: false })
                    .limit(3)

                if (error) throw error
                setApps(data)
            } catch (error) {
                console.error('Error fetching apps:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchApps()
    }, [supabase, session?.user?.id])

    if (loading) {
        return (
            <SidebarMenuSub>
                <CustomSidebarMenuSubItem>
                    <SidebarMenuSubButton className="w-full text-left flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                        <div className="h-4 w-24 animate-pulse bg-muted rounded" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            </SidebarMenuSub>
        )
    }

    return (
        <SidebarMenuSub>
            {apps.map((app) => (
                <CustomSidebarMenuSubItem key={app.id}>
                    <SidebarMenuSubButton 
                        className="w-full text-left flex items-center gap-2"
                        onClick={() => router.push(`/apps/${app.id}`)}
                    >
                        <AppWindow className="h-4 w-4" />
                        <span className="truncate">{app.name}</span>
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            ))}
            {apps.length > 0 && (
                <CustomSidebarMenuSubItem className="group/item relative hover:underline mt-2">
                    <SidebarMenuSubButton
                        className="w-full cursor-pointer text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1 text-sm pl-2"
                        onClick={() => router.push('/apps')}
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
    currentChatId,
    chats = [],
    isCreatingChat,
    chatTitles,
    onGenerateTitle,
    onChatDeleted,
}: SidebarProps) {
    const [open, setOpen] = useState(false)
    const [isChatsOpen, setIsChatsOpen] = useState(true)
    const [isFilesOpen, setIsFilesOpen] = useState(false)
    const [isAppsOpen, setIsAppsOpen] = useState(false)
    const router = useRouter()
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClient()
    const { isPreviewMode, showAuthPrompt } = useAuth()

    useEffect(() => {
        const getSession = async () => {
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession()
            setSession(currentSession)
        }

        getSession()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [supabase.auth])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Mobile sidebar
    const MobileSidebar = () => (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
                <SidebarProvider>
                    <Sidebar>
                        <SidebarContent>
                            <ScrollArea className="h-[calc(100vh-8rem)]">
                                <SidebarGroup>
                                    <SidebarMenu>
                                        <SidebarMenuItem className="flex justify-center">
                                            <SidebarMenuButton
                                                onClick={() => router.push('/')}
                                                className="w-full flex items-center justify-center bg-background border border-border hover:bg-accent"
                                            >
                                                {!open && (
                                                    <Plus className="h-4 w-4" />
                                                )}
                                                {open && (
                                                    <span>New Project</span>
                                                )}
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                </SidebarGroup>

                                <SidebarGroup>
                                    <SidebarGroupLabel>Hub</SidebarGroupLabel>
                                    <Collapsible
                                        open={isChatsOpen}
                                        onOpenChange={setIsChatsOpen}
                                    >
                                        <SidebarMenu>
                                            <SidebarMenuItem className="flex justify-center">
                                                <SidebarMenuButton
                                                    className="w-full flex items-center jusitfy-between"
                                                    tooltip="Your previous chats"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                    {open && (
                                                        <span className="ml-2">
                                                            Projects
                                                        </span>
                                                    )}
                                                </SidebarMenuButton>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuAction>
                                                        <ChevronRight
                                                            className={cn(
                                                                'h-4 w-4 transition-transform',
                                                                isChatsOpen &&
                                                                    'rotate-90'
                                                            )}
                                                        />
                                                    </SidebarMenuAction>
                                                </CollapsibleTrigger>
                                            </SidebarMenuItem>
                                        </SidebarMenu>
                                        <CollapsibleContent>
                                            <ChatsList
                                                chats={chats}
                                                onChatSelect={onChatSelect}
                                                currentChatId={currentChatId}
                                                isCreatingChat={isCreatingChat}
                                                chatTitles={chatTitles}
                                                onGenerateTitle={
                                                    onGenerateTitle
                                                }
                                                onChatDeleted={onChatDeleted}
                                            />
                                        </CollapsibleContent>
                                    </Collapsible>

                                    <SidebarSeparator className="my-2" />

                                    <Collapsible
                                        open={isFilesOpen}
                                        onOpenChange={setIsFilesOpen}
                                    >
                                        <SidebarMenu>
                                            <SidebarMenuItem className="flex justify-center">
                                                <SidebarMenuButton
                                                    className="w-full flex items-center jusitfy-between"
                                                    tooltip="Manage your files"
                                                    onClick={() => router.push('/files')}
                                                >
                                                    <File className="h-4 w-4" />
                                                    {open && (
                                                        <span className="ml-2">
                                                            Files
                                                        </span>
                                                    )}
                                                </SidebarMenuButton>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuAction>
                                                        <ChevronRight 
                                                            className={cn(
                                                                'h-4 w-4 transition-transform',
                                                                isFilesOpen &&
                                                                    'rotate-90'
                                                            )}
                                                        />
                                                    </SidebarMenuAction>
                                                </CollapsibleTrigger>
                                            </SidebarMenuItem>
                                        </SidebarMenu>
                                        <CollapsibleContent>
                                            <FilesList />
                                        </CollapsibleContent>
                                    </Collapsible>

                                    <Collapsible
                                        open={isAppsOpen}
                                        onOpenChange={setIsAppsOpen}
                                    >
                                        <SidebarMenu>
                                            <SidebarMenuItem className="flex justify-center">
                                                <SidebarMenuButton
                                                    className="w-full flex items-center jusitfy-between"
                                                    tooltip="Your applications"
                                                    onClick={() => router.push('/apps')}
                                                >
                                                    <AppWindow className="h-4 w-4" />
                                                    {open && (
                                                        <span className="ml-2">
                                                            Apps
                                                        </span>
                                                    )}
                                                </SidebarMenuButton>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuAction>
                                                        <ChevronRight 
                                                            className={cn(
                                                                'h-4 w-4 transition-transform',
                                                                isAppsOpen &&
                                                                    'rotate-90'
                                                            )}
                                                        />
                                                    </SidebarMenuAction>
                                                </CollapsibleTrigger>
                                            </SidebarMenuItem>
                                        </SidebarMenu>
                                        <CollapsibleContent>
                                            <AppsList />
                                        </CollapsibleContent>
                                    </Collapsible>
                                </SidebarGroup>
                            </ScrollArea>
                        </SidebarContent>
                        <SidebarFooter>
                            <SidebarMenu>
                                <SidebarMenuItem className="flex justify-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <SidebarMenuButton
                                                size="lg"
                                                className="w-full flex items-center justify-center data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                            >
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
                                                        {session?.user
                                                            ?.user_metadata
                                                            ?.full_name?.[0] ||
                                                            'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {open && (
                                                    <>
                                                        <div className="grid flex-1 text-left text-sm leading-tight ml-2">
                                                            <span className="truncate font-semibold">
                                                                {session?.user
                                                                    ?.user_metadata
                                                                    ?.full_name ||
                                                                    'Guest User'}
                                                            </span>
                                                            <span className="truncate text-xs">
                                                                {session?.user
                                                                    ?.email ||
                                                                    'Not signed in'}
                                                            </span>
                                                        </div>
                                                        <ChevronsUpDown className="ml-auto size-4" />
                                                    </>
                                                )}
                                            </SidebarMenuButton>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            className="w-56 rounded-lg"
                                            align="end"
                                            sideOffset={4}
                                        >
                                            <DropdownMenuLabel className="font-normal">
                                                <div className="flex items-center gap-2">
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
                                                            {session?.user
                                                                ?.user_metadata
                                                                ?.full_name?.[0] ||
                                                                'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                                        <span className="font-semibold">
                                                            {session?.user
                                                                ?.user_metadata
                                                                ?.full_name ||
                                                                'Guest User'}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {session?.user
                                                                ?.email ||
                                                                'Not signed in'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuItem>
                                                    <Sparkles className="mr-2 h-4 w-4" />
                                                    <span>Upgrade to Pro</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuItem>
                                                    <BadgeCheck className="mr-2 h-4 w-4" />
                                                    <span>Account</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <CreditCard className="mr-2 h-4 w-4" />
                                                    <span>Billing</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="cursor-default hover:!bg-transparent"
                                                    onSelect={(e) =>
                                                        e.preventDefault()
                                                    }
                                                >
                                                    <div className="w-full">
                                                        <ThemeSwitcherButton />
                                                    </div>
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={handleSignOut}
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                <span>Log out</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarFooter>
                        <SidebarRail />
                    </Sidebar>
                </SidebarProvider>
            </SheetContent>
        </Sheet>
    )

    const userProfile = isPreviewMode ? (
        <SidebarMenuItem className="flex justify-center">
            <Button
                variant="secondary"
                className="w-full relative group hover:opacity-90 transition-all duration-200 rounded-xl border shadow-sm bg-background/80 backdrop-blur-sm hover:shadow-md hover:scale-[1.02]"
                onClick={async () => {
                    const supabase = createClient()
                    await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: `https://pyapps.co/auth/callback`,
                        },
                    })
                }}
            >
                <div className={cn(
                    "flex items-center gap-2",
                    !open && "justify-center w-full"
                )}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    {open && (
                        <span className="font-medium">
                            Continue with Google
                        </span>
                    )}
                </div>
            </Button>
        </SidebarMenuItem>
    ) : (
        <SidebarMenuItem className="flex justify-center">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                        size="lg"
                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                        <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarImage
                                src={
                                    session?.user?.user_metadata?.avatar_url ||
                                    '/default-avatar.png'
                                }
                                alt={
                                    session?.user?.user_metadata?.full_name ||
                                    'User'
                                }
                            />
                            <AvatarFallback className="rounded-lg">
                                {session?.user?.user_metadata?.full_name?.[0] ||
                                    'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">
                                {session?.user?.user_metadata?.full_name ||
                                    'Guest User'}
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
                                    CN
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">
                                    {session?.user?.user_metadata?.full_name ||
                                        'Guest User'}
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
                        <DropdownMenuItem
                            className="cursor-default hover:!bg-transparent"
                            onSelect={(e) => e.preventDefault()}
                        >
                            <div className="w-full">
                                <ThemeSwitcherButton />
                            </div>
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
    )

    return (
        <div className="flex z-50">
            <MobileSidebar />
            <SidebarProvider open={open} onOpenChange={setOpen}>
                <Sidebar
                    variant="sidebar"
                    collapsible="icon"
                    className="hidden md:flex"
                >
                    <SidebarHeader>
                        <SidebarMenu>
                            <SidebarMenuItem className="w-full flex justify-between items-center">
                                <Link
                                    href="/"
                                    className="flex items-center gap-2"
                                >
                                    <Logo inverted collapsed={!open} />
                                </Link>
                                {open && (
                                    <SidebarTrigger className="relative z-30" />
                                )}
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarHeader>
                    <SidebarContent>
                        <ScrollArea className="h-[calc(100vh-8rem)]">
                            <SidebarGroup>
                                <SidebarMenu>
                                    <SidebarMenuItem className="flex justify-center">
                                        <SidebarMenuButton
                                            onClick={() => router.push('/')}
                                            className="w-full flex items-center justify-center bg-background border border-border hover:bg-accent"
                                        >
                                            {!open && (
                                                <Plus className="h-4 w-4" />
                                            )}
                                            {open && <span>New Project</span>}
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroup>

                            <SidebarGroup>
                                <SidebarGroupLabel>Hub</SidebarGroupLabel>
                                <Collapsible
                                    open={isChatsOpen}
                                    onOpenChange={setIsChatsOpen}
                                >
                                    <SidebarMenu>
                                        <SidebarMenuItem className="flex justify-center">
                                            <SidebarMenuButton
                                                className="w-full flex items-center jusitfy-between"
                                                tooltip="Your previous chats"
                                            >
                                                <MessageSquare className="h-4 w-4" />
                                                {open && (
                                                    <span className="ml-2">
                                                        Projects
                                                    </span>
                                                )}
                                            </SidebarMenuButton>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuAction>
                                                    <ChevronRight
                                                        className={cn(
                                                            'h-4 w-4 transition-transform',
                                                            isChatsOpen &&
                                                                'rotate-90'
                                                        )}
                                                    />
                                                </SidebarMenuAction>
                                            </CollapsibleTrigger>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                    <CollapsibleContent>
                                        <ChatsList
                                            chats={chats}
                                            onChatSelect={onChatSelect}
                                            currentChatId={currentChatId}
                                            isCreatingChat={isCreatingChat}
                                            chatTitles={chatTitles}
                                            onGenerateTitle={onGenerateTitle}
                                            onChatDeleted={onChatDeleted}
                                        />
                                    </CollapsibleContent>
                                </Collapsible>

                                <SidebarSeparator className="my-2" />

                                <Collapsible
                                    open={isFilesOpen}
                                    onOpenChange={setIsFilesOpen}
                                >
                                    <SidebarMenu>
                                        <SidebarMenuItem className="flex justify-center">
                                            <SidebarMenuButton
                                                className="w-full flex items-center jusitfy-between"
                                                tooltip="Manage your files"
                                                onClick={() => router.push('/files')}
                                            >
                                                <File className="h-4 w-4" />
                                                {open && (
                                                    <span className="ml-2">
                                                        Files
                                                    </span>
                                                )}
                                            </SidebarMenuButton>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuAction>
                                                    <ChevronRight 
                                                        className={cn(
                                                            'h-4 w-4 transition-transform',
                                                            isFilesOpen &&
                                                                'rotate-90'
                                                        )}
                                                    />
                                                </SidebarMenuAction>
                                            </CollapsibleTrigger>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                    <CollapsibleContent>
                                        <FilesList />
                                    </CollapsibleContent>
                                </Collapsible>

                                <Collapsible
                                    open={isAppsOpen}
                                    onOpenChange={setIsAppsOpen}
                                >
                                    <SidebarMenu>
                                        <SidebarMenuItem className="flex justify-center">
                                            <SidebarMenuButton
                                                className="w-full flex items-center jusitfy-between"
                                                tooltip="Your applications"
                                                onClick={() => router.push('/apps')}
                                            >
                                                <AppWindow className="h-4 w-4" />
                                                {open && (
                                                    <span className="ml-2">
                                                        Apps
                                                    </span>
                                                )}
                                            </SidebarMenuButton>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuAction>
                                                    <ChevronRight 
                                                        className={cn(
                                                            'h-4 w-4 transition-transform',
                                                            isAppsOpen &&
                                                                'rotate-90'
                                                        )}
                                                    />
                                                </SidebarMenuAction>
                                            </CollapsibleTrigger>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                    <CollapsibleContent>
                                        <AppsList />
                                    </CollapsibleContent>
                                </Collapsible>
                            </SidebarGroup>
                        </ScrollArea>
                    </SidebarContent>
                    <SidebarGroup className="mt-auto">
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {!open && (
                                    <SidebarMenuItem className="flex justify-center">
                                        <SidebarMenuButton>
                                            <SidebarTrigger className="w-4 h-4" />
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarFooter>
                        <SidebarMenu>
                            <SidebarMenu>{userProfile}</SidebarMenu>
                        </SidebarMenu>
                    </SidebarFooter>
                    <SidebarRail />
                </Sidebar>
            </SidebarProvider>
        </div>
    )
}

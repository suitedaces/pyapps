'use client'

import { cn } from '@/lib/utils'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import {
    AppWindow,
    ChevronDown,
    ChevronLeft,
    FolderOpen,
    LogOut,
    Menu,
    MessageSquare,
    Plus,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

import { Logo } from '@/components/core/Logo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarProps {
    defaultCollapsed?: boolean
    className?: string
    onChatSelect?: (chatId: string) => void
    currentChatId?: string | null
    chats?: any[]
    collapsed?: boolean
    onCollapsedChange?: (collapsed: boolean) => void
}

// First, let's update the NavItem interface to ensure proper typing
interface NavItemProps {
    item: {
        title: string
        icon: any
        href: string
        pattern: RegExp
        collapsible?: boolean
    }
    collapsed: boolean
    onToggle?: () => void
}

export function Sidebar({
    defaultCollapsed = false,
    className,
    onChatSelect,
    currentChatId,
    chats = [],
    collapsed = false,
    onCollapsedChange,
}: SidebarProps) {
    const [isChatsCollapsed, setIsChatsCollapsed] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClientComponentClient()

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })
    }, [supabase.auth])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
    }

    // Update mainNavItems array
    const mainNavItems = [
        {
            title: 'Chats',
            icon: MessageSquare,
            href: '/chat',
            pattern: /^\/chat/,
            collapsible: true,
        },
    ]

    const subNavItems = [
        {
            title: 'Files',
            icon: FolderOpen,
            href: '/files',
            pattern: /^\/files/,
        },
        {
            title: 'Apps',
            icon: AppWindow,
            href: '/apps',
            pattern: /^\/apps/,
        },
    ]

    // Update the ChatList component
    const ChatList = ({
        collapsed,
        chats = [],
        currentChatId,
        onChatSelect,
    }: {
        collapsed: boolean
        chats: any[]
        currentChatId?: string | null
        onChatSelect?: (chatId: string) => void
    }) => {
        // When collapsed, only show the current chat or the first chat
        const chatsToShow = collapsed
            ? [
                  currentChatId
                      ? chats.find((chat) => chat.id === currentChatId)
                      : chats[0],
              ].filter(Boolean)
            : chats.slice(0, 5)

        return (
            <div
                className={cn(
                    'flex flex-col gap-1',
                    collapsed ? 'px-1' : 'px-2'
                )}
            >
                <ScrollArea className="flex-1 w-full">
                    {chatsToShow.map((chat: any) => (
                        <TooltipProvider key={chat.id}>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            'w-full mb-1 relative group text-left',
                                            collapsed
                                                ? 'justify-center px-2'
                                                : 'justify-start',
                                            chat.id === currentChatId
                                                ? 'bg-white/20 text-white hover:bg-white/20'
                                                : 'text-white hover:bg-white/10 hover:text-white'
                                        )}
                                        onClick={() => onChatSelect?.(chat.id)}
                                    >
                                        <MessageSquare
                                            className={cn(
                                                'h-4 w-4 shrink-0',
                                                collapsed ? 'mx-auto' : 'mr-2'
                                            )}
                                        />
                                        {!collapsed && (
                                            <span className="truncate text-left">
                                                {chat.title || 'New'}
                                            </span>
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                {collapsed && (
                                    <TooltipContent side="right">
                                        {chat.title || 'New'}
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </ScrollArea>
            </div>
        )
    }

    // Update NavItem component
    const NavItem = ({ item, collapsed, onToggle }: NavItemProps) => {
        const isActive = item.pattern.test(pathname)
        const isChatsItem = item.title === 'Chats'

        return (
            <TooltipProvider>
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <div className="w-full">
                            <Button
                                variant="ghost"
                                size={collapsed ? 'icon' : 'default'}
                                className={cn(
                                    'w-full justify-start gap-2',
                                    'text-white hover:bg-white/10 hover:text-white',
                                    isActive &&
                                        'bg-white/20 text-white hover:bg-white/20'
                                )}
                                onClick={isChatsItem ? onToggle : undefined}
                                asChild={!isChatsItem}
                            >
                                {!isChatsItem ? (
                                    <Link href={item.href}>
                                        <item.icon
                                            className={cn(
                                                'h-4 w-4 text-white',
                                                collapsed ? 'mx-auto' : 'mr-2'
                                            )}
                                        />
                                        {!collapsed && (
                                            <span className="text-white">
                                                {item.title}
                                            </span>
                                        )}
                                    </Link>
                                ) : (
                                    <>
                                        <item.icon
                                            className={cn(
                                                'h-4 w-4 text-white',
                                                collapsed ? 'mx-auto' : 'mr-2'
                                            )}
                                        />
                                        {!collapsed && (
                                            <div className="flex items-center justify-between w-full">
                                                <span className="text-white">
                                                    {item.title}
                                                </span>
                                                <ChevronDown
                                                    className={cn(
                                                        'h-4 w-4 transition-transform text-white',
                                                        !isChatsCollapsed &&
                                                            'rotate-90'
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </Button>
                        </div>
                    </TooltipTrigger>
                    {collapsed && (
                        <TooltipContent
                            side="right"
                            className="flex items-center gap-4"
                        >
                            {item.title}
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
        )
    }

    // Mobile sidebar
    const MobileSidebar = () => (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
                <div className="h-full flex flex-col">
                    <div className="p-4">
                        <Link
                            href="/"
                            className="flex items-center gap-2 font-semibold"
                        >
                            py_apps
                        </Link>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        <div className="flex flex-col gap-2">
                            {mainNavItems.map((item) => (
                                <NavItem
                                    key={item.href}
                                    item={item}
                                    collapsed={false}
                                />
                            ))}
                            {(pathname === '/' ||
                                pathname.startsWith('/chat')) && (
                                <ChatList
                                    collapsed={false}
                                    chats={chats}
                                    currentChatId={currentChatId}
                                    onChatSelect={onChatSelect}
                                />
                            )}
                        </div>
                    </ScrollArea>
                    <div className="p-4">
                        <Separator className="mb-4" />
                        <div className="flex flex-col gap-2">
                            {subNavItems.map((item) => (
                                <NavItem
                                    key={item.href}
                                    item={{ ...item, collapsible: true }}
                                    collapsed={false}
                                />
                            ))}
                            <Button
                                variant="ghost"
                                size="default"
                                className="w-full justify-start gap-2 text-foreground hover:bg-red-500/20 hover:text-red-400"
                                onClick={handleSignOut}
                            >
                                <LogOut className="h-4 w-4 text-foreground mr-2 hover:text-red-400" />
                                Sign out
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )

    // Add this function inside Sidebar component
    const handleNewChat = () => {
        window.location.href = '/'
    }

    // Update DesktopSidebar component
    const DesktopSidebar = () => {
        return (
            <motion.div
                initial={false}
                animate={{
                    width: collapsed
                        ? 'var(--collapsed-width)'
                        : 'var(--expanded-width)',
                }}
                className={cn(
                    'hidden md:flex h-screen border-r bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60 relative',
                    className
                )}
                style={
                    {
                        '--collapsed-width': '4rem',
                        '--expanded-width': '14rem',
                    } as React.CSSProperties
                }
            >
                <div className="flex h-full w-full flex-col gap-4">
                    <div className="flex h-14 items-center justify-between px-4">
                        {collapsed ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn('h-6 w-6')}
                                onClick={() => onCollapsedChange?.(!collapsed)}
                            >
                                <ChevronLeft
                                    className={cn(
                                        'h-4 w-4 transition-transform text-white',
                                        collapsed && 'rotate-180'
                                    )}
                                />
                            </Button>
                        ) : (
                            <div className="flex items-center justify-between w-full">
                                <Logo collapsed={false} />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn('h-6 w-6 ml-2')}
                                    onClick={() =>
                                        onCollapsedChange?.(!collapsed)
                                    }
                                >
                                    <ChevronLeft className="h-4 w-4 text-white" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <ScrollArea className="flex-1 px-2">
                        <div className="flex flex-col gap-2 pb-4">
                            <Button
                                variant="ghost"
                                size={collapsed ? 'icon' : 'default'}
                                className={cn(
                                    'w-full justify-start gap-2',
                                    'text-white hover:bg-white/10 hover:text-white',
                                    collapsed && 'justify-center'
                                )}
                                onClick={handleNewChat}
                            >
                                <Plus
                                    className={cn(
                                        'h-4 w-4',
                                        collapsed ? 'mx-auto' : 'mr-2'
                                    )}
                                />
                                {!collapsed && 'New'}
                            </Button>

                            {mainNavItems.map((item) => (
                                <NavItem
                                    key={item.href}
                                    item={item}
                                    collapsed={collapsed}
                                    onToggle={
                                        item.collapsible
                                            ? () =>
                                                  setIsChatsCollapsed(
                                                      !isChatsCollapsed
                                                  )
                                            : undefined
                                    }
                                />
                            ))}

                            {(pathname === '/' ||
                                pathname.startsWith('/chat')) &&
                                !isChatsCollapsed && (
                                    <ChatList
                                        collapsed={collapsed}
                                        chats={chats}
                                        currentChatId={currentChatId}
                                        onChatSelect={onChatSelect}
                                    />
                                )}

                            <Separator className="my-4 bg-gray-700" />

                            {subNavItems.map((item) => (
                                <NavItem
                                    key={item.href}
                                    item={{ ...item, collapsible: true }}
                                    collapsed={collapsed}
                                />
                            ))}
                        </div>
                    </ScrollArea>

                    <div className="px-2 pb-4">
                        <Separator className="mb-4 bg-gray-700" />
                        <div className="flex flex-col gap-2">
                            <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size={
                                                collapsed ? 'icon' : 'default'
                                            }
                                            className={cn(
                                                'w-full justify-start gap-2 text-white hover:bg-red-500/20 hover:text-red-400 group',
                                                collapsed ? 'mx-auto' : 'mr-2'
                                            )}
                                            onClick={handleSignOut}
                                        >
                                            <LogOut
                                                className={cn(
                                                    'h-4 w-4 text-white group-hover:text-red-400',
                                                    collapsed
                                                        ? 'mx-auto'
                                                        : 'mr-2'
                                                )}
                                            />
                                            {!collapsed && (
                                                <span className="text-white group-hover:text-red-400">
                                                    Sign out
                                                </span>
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    {collapsed && (
                                        <TooltipContent side="right">
                                            Sign out
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {session?.user && (
                            <div className="mt-4">
                                <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            <div
                                                className={cn(
                                                    'flex items-center gap-2 rounded-lg px-2 py-2',
                                                    collapsed
                                                        ? 'justify-center'
                                                        : 'justify-start'
                                                )}
                                            >
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage
                                                        src={
                                                            session.user
                                                                .user_metadata
                                                                ?.avatar_url
                                                        }
                                                        alt={
                                                            session.user
                                                                .user_metadata
                                                                ?.full_name ||
                                                            'User'
                                                        }
                                                    />
                                                    <AvatarFallback>
                                                        {session.user
                                                            .user_metadata
                                                            ?.full_name?.[0] ||
                                                            'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {!collapsed && (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-white">
                                                            {session.user
                                                                .user_metadata
                                                                ?.full_name ||
                                                                'User'}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {session.user.email}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        {collapsed && (
                                            <TooltipContent
                                                side="right"
                                                className="flex flex-col gap-1"
                                            >
                                                <span className="font-medium">
                                                    {session.user.user_metadata
                                                        ?.full_name || 'User'}
                                                </span>
                                                <span className="text-xs">
                                                    {session.user.email}
                                                </span>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        )
    }

    const handleChatSelect = useCallback((chatId: string) => {
        router.push(`/chat/${chatId}`)
    }, [router])

    return (
        <TooltipProvider>
            <MobileSidebar />
            <DesktopSidebar />
        </TooltipProvider>
    )
}

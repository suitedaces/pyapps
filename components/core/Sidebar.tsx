'use client'

import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import {
    ChevronLeft,
    MessageSquare,
    FolderOpen,
    AppWindow,
    Settings,
    LogOut,
    Menu,
    Plus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface SidebarProps {
    defaultCollapsed?: boolean
    className?: string
    onChatSelect?: (chatId: string) => void
    onNewChat?: () => Promise<void>
    currentChatId?: string | null
    chats?: any[]
    isCreatingChat?: boolean
}

// Update Logo component to handle collapsed state
const Logo = ({ collapsed }: { collapsed: boolean }) => {
  return (
    <div className="relative font-mono font-bold tracking-tighter">
      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .cursor {
          animation: blink 1s step-end infinite;
          margin-left: -0.1em;
        }
        .app {
          margin-left: 0.3em;
        }
      `}</style>
      {collapsed ? (
        <span className="text-white text-xl">py</span>
      ) : (
        <>
          <span className="text-white text-xl">py_</span>
          <span className="cursor absolute text-white text-xl">|</span>
          <span className="app text-gray-500 text-xl">app</span>
          <div className="absolute bottom-0 left-0 w-full h-px bg-gray-700"></div>
        </>
      )}
    </div>
  )
}

export function Sidebar({ 
    defaultCollapsed = false, 
    className,
    onChatSelect,
    onNewChat,
    currentChatId,
    chats = [],
    isCreatingChat = false,
}: SidebarProps) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed)
    const [session, setSession] = useState<Session | null>(null)
    const pathname = usePathname()
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
    const ChatList = ({ collapsed, chats = [], currentChatId, onChatSelect }: {
        collapsed: boolean;
        chats: any[];
        currentChatId?: string | null;
        onChatSelect?: (chatId: string) => void;
    }) => {
        const latestChats = chats.slice(0, 5);

        return (
            <div className={cn(
                "flex flex-col gap-1",
                collapsed ? "px-1" : "px-2"
            )}>
                <ScrollArea className="flex-1 w-full">
                    {latestChats.map((chat: any) => (
                        <TooltipProvider key={chat.id}>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full mb-1 relative group",
                                            collapsed ? "justify-center px-2" : "justify-start",
                                            chat.id === currentChatId 
                                                ? "bg-white/20 text-white hover:bg-white/20" 
                                                : "text-white hover:bg-white/10 hover:text-white"
                                        )}
                                        onClick={() => onChatSelect?.(chat.id)}
                                    >
                                        <MessageSquare className={cn(
                                            "h-4 w-4 shrink-0",
                                            collapsed ? "mx-auto" : "mr-2"
                                        )} />
                                        {!collapsed && (
                                            <span className="truncate flex-1">
                                                {chat.title || 'New Chat'}
                                            </span>
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                {collapsed && (
                                    <TooltipContent side="right">
                                        {chat.title || 'New Chat'}
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
    const NavItem = ({ item, collapsed, onToggle }: { 
        item: typeof mainNavItems[0] & { collapsible?: boolean }; 
        collapsed: boolean;
        onToggle?: () => void;
    }) => {
        const isActive = item.pattern.test(pathname)
        
        return (
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div className="w-full">
                        <Button
                            variant="ghost"
                            size={collapsed ? 'icon' : 'default'}
                            className={cn(
                                'w-full justify-start gap-2',
                                'text-white hover:bg-white/10 hover:text-white',
                                isActive && 'bg-white/20 text-white hover:bg-white/20'
                            )}
                            onClick={item.collapsible ? onToggle : undefined}
                            asChild={!item.collapsible}
                        >
                            {!item.collapsible ? (
                                <Link href={item.href}>
                                    <item.icon className={cn(
                                        'h-4 w-4 text-white',
                                        collapsed ? 'mx-auto' : 'mr-2'
                                    )} />
                                    {!collapsed && <span className="text-white">{item.title}</span>}
                                </Link>
                            ) : (
                                <>
                                    <item.icon className={cn(
                                        'h-4 w-4 text-white',
                                        collapsed ? 'mx-auto' : 'mr-2'
                                    )} />
                                    {!collapsed && <span className="text-white">{item.title}</span>}
                                </>
                            )}
                        </Button>
                    </div>
                </TooltipTrigger>
                {collapsed && (
                    <TooltipContent side="right" className="flex items-center gap-4">
                        {item.title}
                    </TooltipContent>
                )}
            </Tooltip>
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
                        <Link href="/" className="flex items-center gap-2 font-semibold">
                            py_app
                        </Link>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        <div className="flex flex-col gap-2">
                            {mainNavItems.map((item) => (
                                <NavItem key={item.href} item={item} collapsed={collapsed} />
                            ))}
                            {pathname.startsWith('/chat') && <ChatList collapsed={collapsed} chats={chats} currentChatId={currentChatId} onChatSelect={onChatSelect} />}
                        </div>
                    </ScrollArea>
                    <div className="p-4">
                        <Separator className="mb-4" />
                        <div className="flex flex-col gap-2">
                            {subNavItems.map((item) => (
                                <NavItem key={item.href} item={item} collapsed={collapsed} />
                            ))}
                            <Button
                                variant="ghost"
                                size="default"
                                className="w-full justify-start gap-2 text-foreground"
                                onClick={handleSignOut}
                            >
                                <LogOut className="h-4 w-4 text-foreground mr-2" />
                                Sign out
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )

    // Update DesktopSidebar component
    const DesktopSidebar = () => {
        const [isChatsCollapsed, setIsChatsCollapsed] = useState(false)

        return (
            <motion.div
                initial={false}
                animate={{
                    width: collapsed ? 'var(--collapsed-width)' : 'var(--expanded-width)',
                }}
                className={cn(
                    'hidden md:flex h-screen border-r bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60 relative',
                    className
                )}
                style={{
                    '--collapsed-width': '4rem',
                    '--expanded-width': '14rem',
                } as React.CSSProperties}
            >
                <div className="flex h-full w-full flex-col gap-4">
                    <div className="flex h-14 items-center justify-between px-4">
                        <Logo collapsed={collapsed} />
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn('h-6 w-6')}
                            onClick={() => setCollapsed(!collapsed)}
                        >
                            <ChevronLeft className={cn(
                                'h-4 w-4 transition-transform text-white',
                                collapsed && 'rotate-180'
                            )} />
                        </Button>
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
                                onClick={onNewChat}
                                asChild
                            >
                                <Link href="/chat">
                                    <Plus className={cn(
                                        'h-4 w-4',
                                        collapsed ? 'mx-auto' : 'mr-2'
                                    )} />
                                    {!collapsed && "New Chat"}
                                </Link>
                            </Button>

                            {mainNavItems.map((item) => (
                                <NavItem 
                                    key={item.href} 
                                    item={item} 
                                    collapsed={collapsed}
                                    onToggle={item.collapsible ? () => setIsChatsCollapsed(!isChatsCollapsed) : undefined}
                                />
                            ))}
                            
                            {pathname.startsWith('/chat') && !isChatsCollapsed && !collapsed && (
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
                                    item={item} 
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
                                            size={collapsed ? 'icon' : 'default'}
                                            className="w-full justify-start gap-2 text-white hover:text-white"
                                            onClick={handleSignOut}
                                        >
                                            <LogOut className={cn(
                                                'h-4 w-4 text-white',
                                                collapsed ? 'mx-auto' : 'mr-2'
                                            )} />
                                            {!collapsed && <span className="text-white">Sign out</span>}
                                        </Button>
                                    </TooltipTrigger>
                                    {collapsed && (
                                        <TooltipContent side="right">Sign out</TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {session?.user && (
                            <div className="mt-4">
                                <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            <div className={cn(
                                                'flex items-center gap-2 rounded-lg px-2 py-2',
                                                collapsed ? 'justify-center' : 'justify-start'
                                            )}>
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage
                                                        src={session.user.user_metadata?.avatar_url}
                                                        alt={session.user.user_metadata?.full_name || 'User'}
                                                    />
                                                    <AvatarFallback>
                                                        {session.user.user_metadata?.full_name?.[0] || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {!collapsed && (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-white">
                                                            {session.user.user_metadata?.full_name || 'User'}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {session.user.email}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        {collapsed && (
                                            <TooltipContent side="right" className="flex flex-col gap-1">
                                                <span className="font-medium">
                                                    {session.user.user_metadata?.full_name || 'User'}
                                                </span>
                                                <span className="text-xs">{session.user.email}</span>
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

    return (
        <TooltipProvider>
            <MobileSidebar />
            <DesktopSidebar />
        </TooltipProvider>
    )
} 
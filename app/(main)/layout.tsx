'use client'

import { Logo } from '@/components/core/Logo'
import LoginPage from '@/components/LoginPage'
import { Sidebar } from '@/components/Sidebar'
import { useSidebar } from '@/contexts/SidebarContext'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'

export default function MainLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { session, isLoading: isAuthLoading } = useAuth()
    const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebar()

    const { data: chats } = useQuery({
        queryKey: ['chats'],
        queryFn: async () => {
            if (!session) return []
            const response = await fetch('/api/conversations?page=1&limit=10')
            if (!response.ok) throw new Error('Failed to fetch chats')
            const data = await response.json()
            return data.chats
        },
        enabled: !!session,
    })

    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                Loading...
            </div>
        )
    }

    if (!session) {
        return <LoginPage />
    }

    return (
        <div className="relative flex h-screen bg-white">
            <Sidebar
                collapsed={sidebarCollapsed}
                onCollapsedChange={setSidebarCollapsed}
                chats={chats || []}
            />
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {sidebarCollapsed && (
                    <div
                        className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200 bg-white"
                        style={{
                            left: '4rem',
                            right: 0,
                        }}
                    >
                        <div className="px-4">
                            <Logo inverted={false} collapsed={false} />
                        </div>
                    </div>
                )}
                <main className={cn(
                    'flex-grow flex px-2 pr-9 flex-col lg:flex-row overflow-hidden justify-center relative bg-white',
                    'h-screen pt-14'
                )}>
                    {children}
                </main>
            </div>
        </div>
    )
}
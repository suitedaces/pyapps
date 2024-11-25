'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { SandboxProvider } from '@/contexts/SandboxContext'
import { useAuth } from '@/contexts/AuthContext'
import { Sandbox } from '@/lib/sandbox'
import { useEffect } from 'react'

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { session } = useAuth()

    // Only cleanup on window unload
    useEffect(() => {
        const cleanup = () => {
            if (session?.user?.id) {
                Sandbox.killUserSandbox(session.user.id)
                    .catch(console.error)
            }
        }

        window.addEventListener('beforeunload', cleanup)
        return () => window.removeEventListener('beforeunload', cleanup)
    }, [session?.user?.id])

    return (
        <AuthProvider>
            <SandboxProvider>
                <SidebarProvider>
                    {children}
                </SidebarProvider>
            </SandboxProvider>
        </AuthProvider>
    )
} 
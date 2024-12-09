import { AuthProvider } from '@/contexts/AuthContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/contexts/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'py_apps - build & share data apps in seconds',
    description: 'Build streamlit apps with AI',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={cn(inter.className, 'antialiased bg-white dark:bg-dark-app')}>
                <ThemeProvider>
                    <Providers>
                        <AuthProvider>
                            <SidebarProvider>
                                {children}
                            </SidebarProvider>
                        </AuthProvider>
                    </Providers>
                </ThemeProvider>
            </body>
        </html>
    )
}

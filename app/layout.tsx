import { AuthProvider } from '@/contexts/AuthContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/providers/theme-provider'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

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
            <head />
            <body
                className={cn(
                    inter.className,
                    'antialiased bg-white dark:bg-dark-app'
                )}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <Providers>
                        <AuthProvider>
                            <SidebarProvider>{children}</SidebarProvider>
                        </AuthProvider>
                    </Providers>
                </ThemeProvider>
            </body>
        </html>
    )
}

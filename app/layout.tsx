import { AuthProvider } from '@/contexts/AuthContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { AI } from '@/lib/ai-config'

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
        <html lang="en">
            <body className={inter.className}>
                <Providers>
                    <AuthProvider>
                        <SidebarProvider>
                            <AI>
                                {children}
                            </AI>
                        </SidebarProvider>
                    </AuthProvider>
                </Providers>
            </body>
        </html>
    )
}

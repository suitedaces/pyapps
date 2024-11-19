import { AuthProvider } from '@/contexts/AuthContext'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SidebarProvider } from '@/contexts/SidebarContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'grunty - generate apps for your data in seconds',
    description: 'Analyze CSV files with Streamlit and AI',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <SidebarProvider>
                    <Providers>
                        <AuthProvider>{children}</AuthProvider>
                    </Providers>
                </SidebarProvider>
            </body>
        </html>
    )
}

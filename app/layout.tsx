import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import ClientLayout from '@/components/ClientLayout'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
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
                <Providers>
                    <ClientLayout>
                        {children}
                    </ClientLayout>
                </Providers>
            </body>
        </html>
    )
}

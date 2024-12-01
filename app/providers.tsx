'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AI } from '@/lib/actions'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            <AI>
                {children}
            </AI>
        </QueryClientProvider>
    )
}

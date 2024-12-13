'use client'

import { useRef, useEffect, useState } from 'react'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { AppHeader } from '@/components/AppHeader'
import { StreamlitFrame, StreamlitFrameRef } from '@/components/StreamlitFrame'
import { AppVersion } from '@/lib/types'
import { Loader2 } from 'lucide-react'

interface AppClientProps {
    app: AppVersion
    sandboxUrl: string
    id: string
}

export function AppClient({ app, sandboxUrl, id }: AppClientProps) {
    const streamlitRef = useRef<StreamlitFrameRef>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [key, setKey] = useState(0)

    useEffect(() => {
        setKey(prev => prev + 1)
        
        const timer = setTimeout(() => {
            setIsLoading(false)
        }, 1000)

        return () => clearTimeout(timer)
    }, [sandboxUrl])

    return (
        <ThemeProvider>
            <div className="min-h-screen flex flex-col bg-white dark:bg-dark-app">
                <AppHeader
                    appId={id}
                    appName={app.name ?? ''}
                    initialVersions={[app] as AppVersion[]}
                    initialUrl={sandboxUrl}
                    streamlitRef={streamlitRef}
                />
                <main className="flex-1 relative">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-dark-app">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        </div>
                    )}
                    <StreamlitFrame 
                        key={key}
                        ref={streamlitRef}
                        url={sandboxUrl} 
                    />
                </main>
            </div>
        </ThemeProvider>
    )
}
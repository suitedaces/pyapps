'use client'

import { useRef } from 'react'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { AppHeader } from '@/components/AppHeader'
import { StreamlitFrame, StreamlitFrameRef } from '@/components/StreamlitFrame'
import { AppVersion } from '@/lib/types'

interface AppClientProps {
    app: AppVersion
    sandboxUrl: string
    id: string
}

export function AppClient({ app, sandboxUrl, id }: AppClientProps) {
    const streamlitRef = useRef<StreamlitFrameRef>(null)

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
                <main className="flex-1">
                    <StreamlitFrame 
                        ref={streamlitRef}
                        url={sandboxUrl} 
                    />
                </main>
            </div>
        </ThemeProvider>
    )
}
'use client'

import { AppHeader } from '@/components/AppHeader'
import { CodeView } from '@/components/CodeView'
import { StreamlitFrame, StreamlitFrameRef } from '@/components/StreamlitFrame'
import { AuthPrompt } from '@/components/ui/auth-prompt'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { AppVersion } from '@/lib/types'
import { Circle, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface AppClientProps {
    app: AppVersion
    id: string
}

export function AppClient({ app, id }: AppClientProps) {
    const { updateSandbox, streamlitUrl, isLoadingSandbox } = useSandboxStore()
    const streamlitRef = useRef<StreamlitFrameRef>(null)
    const [showCode, setShowCode] = useState(false)
    const { showAuthPrompt, session, shouldShowAuthPrompt } = useAuth()

    useEffect(() => {
        // Initialize sandbox when component mounts
        const initSandbox = async () => {
            await updateSandbox(app.code, true, id) // Force execute to match previous behavior
        }
        initSandbox()
    }, []) // Empty dependency array to run only on mount, like before

    useEffect(() => {
        // Show auth prompt after 30 seconds if user is not authenticated
        if (!session) {
            const timer = setTimeout(() => {
                showAuthPrompt()
            }, 30000) // 30 seconds

            return () => clearTimeout(timer)
        }
    }, [session, showAuthPrompt]) // Add missing dependencies

    const CustomHandle = ({ ...props }) => (
        <ResizableHandle
            {...props}
            withHandle
            className="relative bg-transparent w-[6px] transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[3px] h-64 bg-neutral-200/50 dark:bg-neutral-800/50" />
            </div>
        </ResizableHandle>
    )

    return (
        <ThemeProvider>
            <div className="min-h-screen flex flex-col bg-white dark:bg-dark-app">
                {shouldShowAuthPrompt && <AuthPrompt canClose={false} />}
                <AppHeader
                    appId={id}
                    appName={app.name || ''}
                    appDescription={app.description || undefined}
                    initialVersions={[app]}
                    initialUrl={streamlitUrl || ''}
                    streamlitRef={streamlitRef}
                    onToggleCode={() => setShowCode(!showCode)}
                />
                <main className="flex-1">
                    <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel defaultSize={showCode ? 60 : 100}>
                            <div className="h-[calc(100vh-3.5rem)]">
                                {!streamlitUrl ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-dark-app/50 backdrop-blur-sm">
                                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                                    </div>
                                ) : (
                                    <StreamlitFrame
                                        ref={streamlitRef}
                                        url={streamlitUrl}
                                        isLoading={isLoadingSandbox}
                                    />
                                )}
                            </div>
                        </ResizablePanel>
                        {showCode && (
                            <>
                                <CustomHandle />
                                <ResizablePanel
                                    defaultSize={40}
                                    minSize={30}
                                    maxSize={70}
                                >
                                    <div className="h-[calc(100vh-3.5rem)]">
                                        <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-900">
                                            {/* Terminal Header */}
                                            <div className="h-8 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 flex items-center px-3 gap-1">
                                                <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                                                <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                                                <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
                                                <div className="flex-1 flex justify-center">
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                                        app.py
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Terminal Content */}
                                            <div className="flex-1 overflow-y-auto">
                                                <CodeView
                                                    code={app.code || ''}
                                                    isGeneratingCode={false}
                                                    language="python"
                                                    className="overflow-auto p-4"
                                                    containerClassName="border-none shadow-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </ResizablePanel>
                            </>
                        )}
                    </ResizablePanelGroup>
                </main>
            </div>
        </ThemeProvider>
    )
}

'use client'

import { Logo } from './core/Logo'
import { ThemeSwitcherButton } from './ui/theme-button-switcher'
import { Button } from './ui/button'
import { RefreshCcw } from 'lucide-react'
import { VersionSelector } from './VersionSelector'
import { AppVersion } from '@/lib/types'
import { useCallback, useRef } from 'react'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { StreamlitFrameRef } from './StreamlitFrame'

interface AppHeaderProps {
    appId: string
    appName: string
    initialVersions: AppVersion[]
    initialUrl: string
    streamlitRef?: React.RefObject<StreamlitFrameRef>
}

export function AppHeader({ appId, appName, initialVersions, initialUrl, streamlitRef }: AppHeaderProps) {
    const { updateSandbox, setGeneratingCode, setGeneratedCode } = useSandboxStore()
    const isUpdatingRef = useRef(false)

    const handleVersionChange = useCallback(async (version: AppVersion) => {
        if (!version.code || isUpdatingRef.current) return

        isUpdatingRef.current = true
        setGeneratingCode(true)
        
        try {
            setGeneratedCode(version.code)
            await updateSandbox(version.code, true)
            
            if (streamlitRef?.current) {
                requestAnimationFrame(() => {
                    streamlitRef.current?.refreshIframe()
                })
            }
        } catch (error) {
            console.error('Error updating version:', error)
        } finally {
            setGeneratingCode(false)
            isUpdatingRef.current = false
        }
    }, [updateSandbox, setGeneratingCode, setGeneratedCode, streamlitRef])

    const handleRefresh = useCallback(() => {
        if (streamlitRef?.current) {
            streamlitRef.current.refreshIframe()
        }
    }, [streamlitRef])

    return (
        <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-dark-app z-50">
            <div className="h-full px-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Logo inverted={false} />
                    <div className="hidden sm:block">
                        <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {appName}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <VersionSelector
                        appId={appId}
                        initialVersions={initialVersions as AppVersion[]}
                        onVersionChange={handleVersionChange}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                        <RefreshCcw className="h-4 w-4" />
                    </Button>
                    <ThemeSwitcherButton />
                </div>
            </div>
        </header>
    )
} 
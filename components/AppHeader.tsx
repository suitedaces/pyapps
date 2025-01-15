'use client'

import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { AppVersion } from '@/lib/types'
import { Code2, Info, RefreshCcw } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { Logo } from './core/Logo'
import { StreamlitFrameRef } from './StreamlitFrame'
import { Button } from './ui/button'
import { ThemeSwitcherButton } from './ui/theme-button-switcher'
import { VersionSelector } from './VersionSelector'
import Link from 'next/link'

interface AppHeaderProps {
    appId: string
    appName: string
    appDescription?: string
    initialVersions: AppVersion[]
    initialUrl: string
    streamlitRef?: React.RefObject<StreamlitFrameRef>
    onToggleCode?: () => void
}

export function AppHeader({
    appId,
    appName,
    appDescription = 'No description available',
    streamlitRef,
    onToggleCode,
}: AppHeaderProps) {
    const {
        updateSandbox,
        setGeneratingCode,
        setGeneratedCode,
        setIsLoadingSandbox,
    } = useSandboxStore()
    const isUpdatingRef = useRef(false)

    const handleVersionChange = useCallback(
        async (version: AppVersion) => {
            if (!version.code || isUpdatingRef.current) return

            isUpdatingRef.current = true
            setGeneratingCode(true)

            try {
                setIsLoadingSandbox(true)
                setGeneratedCode(version.code)
                await updateSandbox(version.code, true)

                if (streamlitRef?.current) {
                    await new Promise((resolve) =>
                        requestAnimationFrame(resolve)
                    )
                    await new Promise((resolve) => setTimeout(resolve, 2000))
                    streamlitRef.current.refreshIframe()
                }
            } catch (error) {
                console.error('Error updating version:', error)
            } finally {
                setGeneratingCode(false)
                setIsLoadingSandbox(false)
                isUpdatingRef.current = false
            }
        },
        [updateSandbox, setGeneratingCode, setGeneratedCode, streamlitRef]
    )

    const handleRefresh = useCallback(() => {
        if (streamlitRef?.current) {
            streamlitRef.current.refreshIframe()
        }
    }, [streamlitRef])

    const toggleCodeView = () => {
        onToggleCode?.()
    }

    return (
        <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-dark-app z-50">
            <div className="h-full px-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Logo inverted={true} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <HoverCard>
                            <HoverCardTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <Info className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
                                </Button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">
                                        {appName}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        {appDescription}
                                    </p>
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleRefresh}
                                    className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <RefreshCcw className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Refresh App</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleCodeView}
                                    className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <Code2 className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View Code</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <VersionSelector
                        appId={appId}
                        onVersionChange={handleVersionChange}
                    />
                    <ThemeSwitcherButton showLabel={false} />
                </div>
            </div>
        </header>
    )
}


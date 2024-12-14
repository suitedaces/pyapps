'use client'

import { getVersionHistory, switchVersion } from '@/lib/supabase'
import { AppVersion } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import { Button } from './ui/button'

interface VersionSelectorProps {
    appId: string
    onVersionChange: (version: AppVersion) => void
}

export interface VersionSelectorRef {
    refreshVersions: () => void
}

export const VersionSelector = forwardRef<
    VersionSelectorRef,
    VersionSelectorProps
>(function VersionSelector({ appId, onVersionChange }, ref) {
    const [versions, setVersions] = useState<AppVersion[]>([])
    const [currentIndex, setCurrentIndex] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(false)
    const hasInitializedRef = useRef(false)

    const loadVersions = useCallback(async () => {
        if (!appId || isLoading) return

        setIsLoading(true)
        try {
            const versionsData = await getVersionHistory(appId)
            setVersions(versionsData)

            if (versionsData.length > 0) {
                setCurrentIndex(0)

                if (!hasInitializedRef.current) {
                    onVersionChange(versionsData[0])
                    hasInitializedRef.current = true
                }
            }
        } catch (error) {
            console.error('Failed to fetch versions:', error)
        } finally {
            setIsLoading(false)
        }
    }, [appId, onVersionChange, isLoading])

    useImperativeHandle(
        ref,
        () => ({
            refreshVersions: () => {
                hasInitializedRef.current = false
                return loadVersions()
            },
        }),
        [loadVersions]
    )

    useEffect(() => {
        if (appId && !hasInitializedRef.current) {
            loadVersions()
        }
    }, [appId, loadVersions])

    const handleVersionChange = async (newIndex: number) => {
        if (!appId || newIndex < 0 || newIndex >= versions.length || isLoading)
            return

        setIsLoading(true)
        try {
            const selectedVersion = versions[newIndex]
            await switchVersion(appId, selectedVersion.id)

            setCurrentIndex(newIndex)
            setVersions((prev) =>
                prev.map((v, idx) => ({
                    ...v,
                    is_current: idx === newIndex,
                }))
            )

            onVersionChange(selectedVersion)
        } catch (error) {
            console.error('Failed to switch version:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const navigateVersion = (direction: 'prev' | 'next') => {
        const newIndex =
            direction === 'prev' ? currentIndex + 1 : currentIndex - 1
        handleVersionChange(newIndex)
    }

    useEffect(() => {
        console.log('VersionSelector state:', {
            appId,
            versionsCount: versions.length,
            currentIndex,
            isLoading,
            hasInitialized: hasInitializedRef.current,
        })
    }, [
        appId,
        versions.length,
        currentIndex,
        isLoading,
        hasInitializedRef.current,
    ])

    if (versions.length === 0 && !isLoading) return null

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateVersion('prev')}
                disabled={isLoading || currentIndex === versions.length - 1}
                className={cn(
                    'h-9 w-9',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    'text-neutral-700 dark:text-neutral-200',
                    'transition-all duration-200'
                )}
            >
                <ChevronLeft className="h-5 w-5" />
            </Button>

            <div
                className={cn(
                    'flex items-center justify-center min-w-[120px] px-3 py-1.5 rounded-md',
                    'bg-neutral-100/80 dark:bg-neutral-800/80',
                    'border border-neutral-200 dark:border-neutral-700',
                    'backdrop-blur-sm'
                )}
            >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {isLoading ? (
                        'Loading...'
                    ) : versions.length > 0 ? (
                        <>
                            Version {versions[currentIndex]?.version_number}
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-1">
                                / {versions.length}
                            </span>
                        </>
                    ) : (
                        'No versions'
                    )}
                </span>
            </div>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateVersion('next')}
                disabled={isLoading || currentIndex === 0}
                className={cn(
                    'h-9 w-9',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    'text-neutral-700 dark:text-neutral-200',
                    'transition-all duration-200'
                )}
            >
                <ChevronRight className="h-5 w-5" />
            </Button>
        </div>
    )
})

VersionSelector.displayName = 'VersionSelector'

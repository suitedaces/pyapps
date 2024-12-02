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
    const [hasInitialized, setHasInitialized] = useState(false)

    const loadVersions = useCallback(async () => {
        if (!appId || isLoading) return

        setIsLoading(true)
        try {
            console.log('Loading versions for app:', appId)
            const versionsData = await getVersionHistory(appId)
            console.log('Loaded versions:', versionsData)

            if (versionsData && Array.isArray(versionsData)) {
                setVersions(versionsData)

                if (versionsData.length > 0) {
                    setCurrentIndex(0)

                    if (!hasInitialized) {
                        onVersionChange(versionsData[0])
                        setHasInitialized(true)
                    }
                }
            } else {
                console.error('Invalid versions data received:', versionsData)
                setVersions([])
            }
        } catch (error) {
            console.error('Failed to fetch versions:', error)
            setVersions([])
        } finally {
            setIsLoading(false)
        }
    }, [appId, onVersionChange, hasInitialized, isLoading])

    useImperativeHandle(
        ref,
        () => ({
            refreshVersions: async () => {
                setHasInitialized(false)
                await loadVersions()
            },
        }),
        [loadVersions]
    )

    useEffect(() => {
        if (appId) {
            console.log('VersionSelector mounted with appId:', appId)
            setHasInitialized(false)
            loadVersions()
        }
    }, [appId, loadVersions])

    const handleVersionChange = async (newIndex: number) => {
        if (!appId || newIndex < 0 || newIndex >= versions.length || isLoading) {
            console.log('Invalid version change:', { appId, newIndex, versionsLength: versions.length, isLoading })
            return
        }

        setIsLoading(true)
        try {
            const selectedVersion = versions[newIndex]
            console.log('Switching to version:', selectedVersion)

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
            hasInitialized,
        })
    }, [appId, versions.length, currentIndex, isLoading, hasInitialized])

    if (versions.length === 0 && !isLoading) return null

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="icon"
                onClick={() => navigateVersion('prev')}
                disabled={isLoading || currentIndex === versions.length - 1}
                className={cn(
                    'h-8 w-8',
                    'bg-white hover:bg-gray-100',
                    'border border-gray-200',
                    'text-gray-700',
                    'transition-all duration-200'
                )}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center justify-center min-w-[120px] px-3 py-1.5 bg-white border border-gray-200 rounded-md">
                <span className="text-sm font-medium text-gray-700">
                    {isLoading ? (
                        'Loading...'
                    ) : versions.length > 0 ? (
                        <>
                            Version {versions[currentIndex]?.version_number}
                            <span className="text-xs text-gray-400 ml-1">
                                / {versions.length}
                            </span>
                        </>
                    ) : (
                        'No versions'
                    )}
                </span>
            </div>

            <Button
                variant="outline"
                size="icon"
                onClick={() => navigateVersion('next')}
                disabled={isLoading || currentIndex === 0}
                className={cn(
                    'h-8 w-8',
                    'bg-white hover:bg-gray-100',
                    'border border-gray-200',
                    'text-gray-700',
                    'transition-all duration-200'
                )}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
})

VersionSelector.displayName = 'VersionSelector'

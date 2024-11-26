'use client'

import { Button } from './ui/button'
import { useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { AppVersion } from '@/lib/types'
import { getVersionHistory, switchVersion } from '@/lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VersionSelectorProps {
    appId: string
    onVersionChange: (version: AppVersion) => void
}

export interface VersionSelectorRef {
    refreshVersions: () => void
}

export const VersionSelector = forwardRef<VersionSelectorRef, VersionSelectorProps>(
    function VersionSelector({ appId, onVersionChange }, ref) {
        const [versions, setVersions] = useState<AppVersion[]>([])
        const [currentIndex, setCurrentIndex] = useState<number>(0)
        const [isLoading, setIsLoading] = useState(false)
        const [isInitialLoad, setIsInitialLoad] = useState(true)

        const loadVersions = async () => {
            if (!appId) return

            setIsLoading(true)
            try {
                const versionsData = await getVersionHistory(appId)
                setVersions(versionsData)

                if (versionsData.length > 0) {
                    setCurrentIndex(0)

                    if (isInitialLoad) {
                        onVersionChange(versionsData[0])
                        setIsInitialLoad(false)
                    }
                }
            } catch (error) {
                console.error('Failed to fetch versions:', error)
            } finally {
                setIsLoading(false)
            }
        }

        useImperativeHandle(ref, () => ({
            refreshVersions: loadVersions
        }))

        useEffect(() => {
            loadVersions()
        }, [appId])

        const handleVersionChange = async (newIndex: number) => {
            if (!appId || newIndex < 0 || newIndex >= versions.length) return

            setIsLoading(true)
            try {
                const selectedVersion = versions[newIndex]
                await switchVersion(appId, selectedVersion.id)

                setCurrentIndex(newIndex)
                setVersions(prev => prev.map((v, idx) => ({
                    ...v,
                    is_current: idx === newIndex
                })))

                onVersionChange(selectedVersion)
            } catch (error) {
                console.error('Failed to switch version:', error)
            } finally {
                setIsLoading(false)
            }
        }

        const navigateVersion = (direction: 'prev' | 'next') => {
            const newIndex = direction === 'prev' ? currentIndex + 1 : currentIndex - 1
            handleVersionChange(newIndex)
        }

        if (versions.length === 0) return null

        return (
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateVersion('prev')}
                    disabled={isLoading || currentIndex === versions.length - 1}
                    className={cn(
                        "h-8 w-8",
                        "bg-white hover:bg-gray-100",
                        "border border-gray-200",
                        "text-gray-700",
                        "transition-all duration-200"
                    )}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center justify-center min-w-[120px] px-3 py-1.5 bg-white border border-gray-200 rounded-md">
                    <span className="text-sm font-medium text-gray-700">
                        {isLoading ? (
                            "Loading..."
                        ) : (
                            <>
                                Version {versions[currentIndex]?.version_number}
                                <span className="text-xs text-gray-400 ml-1">
                                    / {versions.length}
                                </span>
                            </>
                        )}
                    </span>
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateVersion('next')}
                    disabled={isLoading || currentIndex === 0}
                    className={cn(
                        "h-8 w-8",
                        "bg-white hover:bg-gray-100",
                        "border border-gray-200",
                        "text-gray-700",
                        "transition-all duration-200"
                    )}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        )
    }
)

VersionSelector.displayName = 'VersionSelector'

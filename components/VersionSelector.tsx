'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { AppVersion } from '@/lib/types'
import { getVersionHistory, switchVersion } from '@/lib/supabase'

// Props we need to make this work
interface VersionSelectorProps {
    appId: string
    onVersionChange: (version: AppVersion) => void
}

// This lets parent components refresh our versions list
export interface VersionSelectorRef {
    refreshVersions: () => void
}

// Main component - using forwardRef so parent can call our refresh function
export const VersionSelector = forwardRef<VersionSelectorRef, VersionSelectorProps>(
    function VersionSelector({ appId, onVersionChange }, ref) {
        // Track all the versions and which one is current
        const [versions, setVersions] = useState<AppVersion[]>([])
        const [currentVersionId, setCurrentVersionId] = useState<string>()
        const [isLoading, setIsLoading] = useState(false)

        // Only update code view on first load
        const [isInitialLoad, setIsInitialLoad] = useState(true)

        // Fetch and set up versions
        const loadVersions = async () => {
            if (!appId) return

            setIsLoading(true)
            try {
                // Get all versions for this app
                const versionsData = await getVersionHistory(appId)
                setVersions(versionsData)

                // If we have versions, set up the latest one
                if (versionsData.length > 0) {
                    const latestVersion = versionsData[0]
                    setCurrentVersionId(latestVersion.id)

                    // Only update code on first load to avoid loops
                    if (isInitialLoad) {
                        onVersionChange(latestVersion)
                        setIsInitialLoad(false)
                    }
                }
            } catch (error) {
                console.error('Failed to fetch versions:', error)
            } finally {
                setIsLoading(false)
            }
        }

        // Let parent components call our refresh function
        useImperativeHandle(ref, () => ({
            refreshVersions: loadVersions
        }))

        // Load versions when app changes
        useEffect(() => {
            loadVersions()
        }, [appId])

        // Handle version selection
        const handleVersionChange = async (versionId: string) => {
            if (!appId || !versionId) return

            setIsLoading(true)
            try {
                // Find the version they picked
                const selectedVersion = versions.find(v => v.id === versionId)
                if (!selectedVersion) throw new Error('Version not found')

                // Update in the database
                await switchVersion(appId, versionId)

                // Update our local state
                setCurrentVersionId(versionId)
                setVersions(prev => prev.map(v => ({
                    ...v,
                    is_current: v.id === versionId
                })))

                // Let parent know to update code view
                onVersionChange(selectedVersion)

            } catch (error) {
                console.error('Failed to switch version:', error)
            } finally {
                setIsLoading(false)
            }
        }

        // Nice clean dropdown for version selection
        return (
            <Select
                value={currentVersionId}
                onValueChange={handleVersionChange}
                disabled={isLoading}
            >
                <SelectTrigger className="w-[180px] text-black">
                    <SelectValue
                        placeholder={isLoading ? "Loading..." : "Select version"}
                        className="text-black"
                    />
                </SelectTrigger>
                <SelectContent className="text-black">
                    {versions.map((version) => (
                        <SelectItem
                            key={version.id}
                            value={version.id}
                            className="text-black"
                        >
                            Version {version.version_number}
                            {version.is_current && " (Current)"}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        )
    }
)

// Help React DevTools show a nice name
VersionSelector.displayName = 'VersionSelector'

'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useEffect, useState } from 'react'
import { AppVersion } from '@/lib/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { getVersionHistory, switchVersion } from '@/lib/supabase'

interface VersionSelectorProps {
    appId: string
    onVersionChange: (version: AppVersion) => void
}

export function VersionSelector({ appId, onVersionChange }: VersionSelectorProps) {
    const [versions, setVersions] = useState<AppVersion[]>([])
    const [currentVersionId, setCurrentVersionId] = useState<string>()
    const supabase = createClientComponentClient()

    useEffect(() => {
        async function loadVersions() {
            if (!appId) return

            const { data, error } = await supabase
                .rpc('get_app_versions', {
                    p_app_id: appId
                })

            if (error) {
                console.error('Failed to fetch versions:', error)
                return
            }

            setVersions(data || [])
            const currentVersion = data?.find((v: AppVersion) => v.is_current)
            if (currentVersion) {
                setCurrentVersionId(currentVersion.id)
            }
        }

        loadVersions()
    }, [appId])

    const handleVersionChange = async (versionId: string) => {
        const version = versions.find(v => v.id === versionId)
        if (version) {
            try {
                // Switch version using RPC
                const { error } = await switchVersion(appId, versionId)

                if (error) throw error

                setCurrentVersionId(versionId)
                onVersionChange(version)
            } catch (error) {
                console.error('Failed to switch version:', error)
            }
        }
    }

    return (
        <Select value={currentVersionId} onValueChange={handleVersionChange}>
            <SelectTrigger className="w-[180px] text-black">
                <SelectValue placeholder="Select version" className="text-black" />
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

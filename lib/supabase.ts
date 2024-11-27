import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { AppVersion, VersionMetadata } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Version management functions
export async function createVersion(
    appId: string,
    code: string
): Promise<VersionMetadata> {
    try {
        if (!appId || !code) {
            throw new Error('Missing required parameters')
        }

        // Create version using RPC
        const { data, error } = await supabase.rpc('create_app_version', {
            p_app_id: appId,
            p_code: code,
        })

        if (error) throw error

        // Update app's current_version_id
        const { error: updateError } = await supabase
            .from('apps')
            .update({
                current_version_id: data.version_id,
                updated_at: new Date().toISOString(),
            })
            .eq('id', appId)

        if (updateError) throw updateError

        console.log('Version created and app updated:', data)
        return data
    } catch (error) {
        console.error('Failed to create version:', error)
        throw error
    }
}

export async function switchVersion(
    appId: string,
    versionId: string
): Promise<{ error?: Error }> {
    try {
        const { error: rpcError } = await supabase.rpc('switch_app_version', {
            p_app_id: appId,
            p_version_id: versionId,
        })

        if (rpcError) {
            console.error('Error switching version:', rpcError)
            return { error: rpcError }
        }

        return {}
    } catch (error) {
        console.error('Error in switchVersion:', error)
        return {
            error: error instanceof Error ? error : new Error('Unknown error'),
        }
    }
}

export async function getVersionHistory(appId: string): Promise<AppVersion[]> {
    try {
        const { data, error } = await supabase
            .from('app_versions')
            .select('*')
            .eq('app_id', appId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching versions:', error)
            throw error
        }

        // Set the latest version as current and transform data to match AppVersion type
        if (data && data.length > 0) {
            const latestVersion = data[0]
            await supabase
                .from('apps')
                .update({ current_version_id: latestVersion.id })
                .eq('id', appId)

            // Transform data to include is_current
            return data.map((version, index) => ({
                ...version,
                is_current: index === 0, // Mark only the latest version as current
            })) as AppVersion[]
        }

        return []
    } catch (error) {
        console.error('Failed to fetch versions:', error)
        throw error
    }
}

// Custom RPC functions
export async function updateAppPublicStatus(
    appId: string,
    versionId: string,
    publicId: string
) {
    const { data, error } = await supabase.rpc('update_app_public_status', {
        p_app_id: appId,
        p_version_id: versionId,
        v_public_id: publicId,
    })

    if (error) throw error
    return data
}

export async function getExpiredFiles(cutoffDate?: string) {
    const { data, error } = await supabase.rpc('get_expired_files', {
        cutoff_date: cutoffDate,
    })

    if (error) throw error
    return data
}

export async function getLatestMessagesByChat(
    userId: string,
    limit: number = 10
) {
    const { data, error } = await supabase.rpc('get_latest_messages_by_chat', {
        p_user_id: userId,
        p_limit: limit,
    })

    if (error) throw error
    return data
}

export async function getUserTotalTokens(userId: string) {
    const { data, error } = await supabase.rpc('get_user_total_tokens', {
        p_user_id: userId,
    })

    if (error) throw error
    return data
}

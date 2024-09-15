import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

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

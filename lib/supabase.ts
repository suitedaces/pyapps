import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

export const getSupabaseClient = (accessToken?: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {},
    },
  });
}


export async function getSupabaseUserId(auth0UserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('auth0_id', auth0UserId)
    .single()

  if (error) throw error
  return data?.id
}

export async function getUserProfile(auth0UserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth0_id', auth0UserId)
    .single()

  if (error) throw error
  return data
}

export async function updateUserProfile(userId: string, updates: Partial<Database['public']['Tables']['users']['Update']>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()

  if (error) throw error
  return data[0]
}

export async function createChat(userId: string, name: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chats')
    .insert({ user_id: userId, name })
    .select()

  if (error) throw error
  return data[0]
}

export async function getUserChats(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function addMessage(chatId: string, userId: string, content: string, role: 'user' | 'assistant') {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ chat_id: chatId, user_id: userId, content, role })
    .select()

  if (error) throw error
  return data[0]
}

export async function createApp(userId: string, name: string, description: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('apps')
    .insert({ user_id: userId, name, description })
    .select()

  if (error) throw error
  return data[0]
}

export async function getUserApps(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function updateApp(appId: string, userId: string, updates: Partial<Database['public']['Tables']['apps']['Update']>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('apps')
    .update(updates)
    .eq('id', appId)
    .eq('user_id', userId)
    .select()

  if (error) throw error
  return data[0]
}

export async function deleteApp(appId: string, userId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('apps')
    .delete()
    .eq('id', appId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function createAppVersion(appId: string, versionNumber: number, codeContent: string, metadata: any) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('app_versions')
    .insert({ app_id: appId, version_number: versionNumber, code_content: codeContent, metadata })
    .select()

  if (error) throw error
  return data[0]
}

export async function uploadFile(userId: string, fileName: string, fileType: string, fileSize: number, fileUrl: string, analysis?: any) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('files')
    .insert({ user_id: userId, file_name: fileName, file_type: fileType, file_size: fileSize, file_url: fileUrl, analysis })
    .select()

  if (error) throw error
  return data[0]
}

export async function getUserFiles(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function deleteFile(fileId: string, userId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId)
    .eq('user_id', userId)

  if (error) throw error
}

export function subscribeToChat(chatId: string, callback: (payload: any) => void) {
  const supabase = getSupabaseClient();
  return supabase
    .channel(`chat:${chatId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, callback)
    .subscribe()
}

export async function createUserInDatabase(email: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .insert({ email })
    .select('*')
    .single()

  if (error) throw error
  return data
}
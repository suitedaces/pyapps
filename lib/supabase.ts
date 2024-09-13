import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// User operations
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Database["public"]["Tables"]["users"]["Update"]>,
) {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Chat operations
export async function createChat(userId: string, name: string, appId?: string) {
  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: userId, name, app_id: appId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserChats(userId: string) {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateChat(
  chatId: string,
  updates: Partial<Database["public"]["Tables"]["chats"]["Update"]>,
) {
  const { data, error } = await supabase
    .from("chats")
    .update(updates)
    .eq("id", chatId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChat(chatId: string) {
  const { error } = await supabase.from("chats").delete().eq("id", chatId);

  if (error) throw error;
}

// Message operations
export async function insertMessage(
  chatId: string,
  userId: string,
  userMessage: string,
  assistantMessage: string,
  tokenCount: number,
  toolCalls?: any,
  toolResults?: any,
) {
  const { data, error } = await supabase.rpc("insert_message", {
    p_chat_id: chatId,
    p_user_id: userId,
    p_user_message: userMessage,
    p_assistant_message: assistantMessage,
    p_token_count: tokenCount,
    p_tool_calls: toolCalls,
    p_tool_results: toolResults,
  });

  if (error) throw error;
  return data;
}

export async function getChatMessages(
  chatId: string,
  limit: number = 50,
  offset: number = 0,
) {
  const { data, error } = await supabase.rpc("get_chat_messages", {
    p_chat_id: chatId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return data;
}

// File operations
export async function uploadFile(
  userId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  fileUrl: string,
  backupUrl?: string,
  contentHash?: string,
  analysis?: any,
  expiresAt?: string,
) {
  const { data, error } = await supabase
    .from("files")
    .insert({
      user_id: userId,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      file_url: fileUrl,
      backup_url: backupUrl,
      content_hash: contentHash,
      analysis,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserFiles(userId: string) {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteFile(fileId: string) {
  const { error } = await supabase.from("files").delete().eq("id", fileId);

  if (error) throw error;
}

export async function updateFileAnalysis(fileId: string, analysis: any) {
  const { data, error } = await supabase
    .from("files")
    .update({ analysis, updated_at: new Date().toISOString() })
    .eq("id", fileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// App operations
export async function createApp(
  userId: string,
  name: string,
  description?: string,
) {
  const { data, error } = await supabase
    .from("apps")
    .insert({ user_id: userId, name, description })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserApps(userId: string) {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateApp(
  appId: string,
  updates: Partial<Database["public"]["Tables"]["apps"]["Update"]>,
) {
  const { data, error } = await supabase
    .from("apps")
    .update(updates)
    .eq("id", appId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteApp(appId: string) {
  const { error } = await supabase.from("apps").delete().eq("id", appId);

  if (error) throw error;
}

// App version operations
export async function createAppVersion(
  appId: string,
  versionNumber: number,
  code: string,
) {
  const { data, error } = await supabase
    .from("app_versions")
    .insert({ app_id: appId, version_number: versionNumber, code })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAppVersions(appId: string) {
  const { data, error } = await supabase
    .from("app_versions")
    .select("*")
    .eq("app_id", appId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return data;
}

// Usage limits operations
export async function getUserUsage(userId: string) {
  const { data, error } = await supabase
    .from("usage_limits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserUsage(
  userId: string,
  updates: Partial<Database["public"]["Tables"]["usage_limits"]["Update"]>,
) {
  const { data, error } = await supabase
    .from("usage_limits")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Custom RPC functions
export async function updateAppPublicStatus(
  appId: string,
  versionId: string,
  publicId: string,
) {
  const { data, error } = await supabase.rpc("update_app_public_status", {
    p_app_id: appId,
    p_version_id: versionId,
    v_public_id: publicId,
  });

  if (error) throw error;
  return data;
}

export async function getExpiredFiles(cutoffDate?: string) {
  const { data, error } = await supabase.rpc("get_expired_files", {
    cutoff_date: cutoffDate,
  });

  if (error) throw error;
  return data;
}

export async function getLatestMessagesByChat(
  userId: string,
  limit: number = 10,
) {
  const { data, error } = await supabase.rpc("get_latest_messages_by_chat", {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) throw error;
  return data;
}

export async function getUserTotalTokens(userId: string) {
  const { data, error } = await supabase.rpc("get_user_total_tokens", {
    p_user_id: userId,
  });

  if (error) throw error;
  return data;
}

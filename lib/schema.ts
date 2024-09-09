// Key prefixes
const USER_PREFIX = "user:";
const CHAT_PREFIX = "chat:";
const SANDBOX_PREFIX = "sandbox:";
const PROJECT_PREFIX = "project:";
const CSV_FILE_PREFIX = "csv:";
const STREAMLIT_APP_PREFIX = "app:";
const USAGE_METRIC_PREFIX = "metric:";

// Interfaces
interface User {
  id: string;
  email: string;
  auth0Id: string;
  name?: string;
  createdAt: number;
  lastLogin: number;
  subscriptionTier: 'free' | 'pro' | 'business';
}

interface Chat {
  id: string;
  userId: string;
  name: string;
  sandboxId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Sandbox {
  id: string;
  userId: string;
  chatId: string;
  e2bSandboxId: string;
  createdAt: number;
  lastUsed: number;
}

interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

interface CSVFile {
  id: string;
  projectId: string;
  name: string;
  size: number;
  columnCount: number;
  rowCount: number;
  createdAt: number;
}

interface StreamlitApp {
  id: string;
  chatId: string;
  name: string;
  code: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

interface UsageMetric {
  id: string;
  userId: string;
  type: 'api_call' | 'storage' | 'computation';
  value: number;
  timestamp: number;
}

// KV operations
export async function createUser(user: User): Promise<void> {
  await GRUNTY_KV.put(`${USER_PREFIX}${user.id}`, JSON.stringify(user));
}

export async function getUser(userId: string): Promise<User | null> {
  const userJson = await GRUNTY_KV.get(`${USER_PREFIX}${userId}`);
  return userJson ? JSON.parse(userJson) : null;
}

export async function getUserByAuth0Id(auth0Id: string): Promise<User | null> {
  const { keys } = await GRUNTY_KV.list({ prefix: USER_PREFIX });
  for (const key of keys) {
    const userJson = await GRUNTY_KV.get(key.name);
    if (userJson) {
      const user: User = JSON.parse(userJson);
      if (user.auth0Id === auth0Id) return user;
    }
  }
  return null;
}

export async function createChat(chat: Chat): Promise<void> {
  await GRUNTY_KV.put(`${CHAT_PREFIX}${chat.id}`, JSON.stringify(chat));
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const chatJson = await GRUNTY_KV.get(`${CHAT_PREFIX}${chatId}`);
  return chatJson ? JSON.parse(chatJson) : null;
}

export async function updateChat(chat: Chat): Promise<void> {
  await GRUNTY_KV.put(`${CHAT_PREFIX}${chat.id}`, JSON.stringify(chat));
}

export async function getUserChats(userId: string): Promise<Chat[]> {
  const { keys } = await GRUNTY_KV.list({ prefix: CHAT_PREFIX });
  const chats: Chat[] = [];
  for (const key of keys) {
    const chatJson = await GRUNTY_KV.get(key.name);
    if (chatJson) {
      const chat: Chat = JSON.parse(chatJson);
      if (chat.userId === userId) chats.push(chat);
    }
  }
  return chats;
}

export async function createSandbox(sandbox: Sandbox): Promise<void> {
  await GRUNTY_KV.put(`${SANDBOX_PREFIX}${sandbox.id}`, JSON.stringify(sandbox));
}

export async function getSandbox(sandboxId: string): Promise<Sandbox | null> {
  const sandboxJson = await GRUNTY_KV.get(`${SANDBOX_PREFIX}${sandboxId}`);
  return sandboxJson ? JSON.parse(sandboxJson) : null;
}

export async function updateSandbox(sandbox: Sandbox): Promise<void> {
  await GRUNTY_KV.put(`${SANDBOX_PREFIX}${sandbox.id}`, JSON.stringify(sandbox));
}

// Add similar CRUD operations for Project, CSVFile, StreamlitApp, and UsageMetric
import { Json } from '@/lib/database.types'
import { Message } from 'ai'
import { z } from 'zod'

// Model types
export interface ModelProvider {
    id: string
    streamText: (params: StreamParams) => Promise<void>
}

export interface StreamParams {
    messages: Message[]
    tools?: Tool[]
    stream?: boolean
    onToken: (token: string) => void
    onToolCall?: (toolInvocation: ToolInvocation) => Promise<void>
}

// Tool types aligned with Vercel AI SDK
export interface ToolCallPayload {
    id: string
    name: string
    parameters: Record<string, any>
}

export interface ToolResultPayload {
    id: string
    name: string
    content: string
}

// Message types aligned with Vercel AI SDK
export interface ClientMessage {
    id: string
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    createdAt: Date
    toolInvocations?: ToolInvocation[]
}

// Database message type
export interface DatabaseMessage {
    id: string
    user_id: string
    chat_id: string
    role: 'system' | 'user' | 'assistant' | 'tool'
    user_message: string
    assistant_message: string
    tool_calls: ToolCall[] | Json
    tool_results: Json | null
    token_count: number
    created_at: string
}

// Tool definition aligned with Vercel AI SDK
export interface Tool {
    toolName: string
    description: string
    parameters: z.ZodObject<any>
    execute: (parameters: Record<string, any>) => Promise<any>
}

// Model configuration
export interface LLMModelConfig {
    model: string
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
}

// Add this to your types.ts
export type LLMModel = {
    id: string
    name: string
    provider: string
    providerId: string
}

export interface ToolInvocation {
    state: 'call' | 'result'
    toolCallId: string
    toolName: string
    args: Record<string, any>
    result?: any
}

export interface ToolCall {
    id: string
    name: string
    parameters: any
}

export interface FileContext {
    id: string;
    fileName: string;
    fileType: 'csv' | 'json' | 'txt';
    content?: string;
    analysis?: any;
}

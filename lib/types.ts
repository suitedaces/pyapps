import { Message as VercelMessage } from 'ai'
import { Json } from '@/lib/database.types'
import { z } from 'zod'

// Model types
export interface ModelProvider {
    id: string
    streamText: (params: StreamParams) => Promise<void>
}

export interface StreamParams {
    messages: VercelMessage[]
    tools?: Tool[]
    stream?: boolean
    onToken: (token: string) => void
    onToolCall?: (tool: ToolCallPayload) => Promise<void>
}

export interface ToolCallPayload {
    id: string
    name: string
    arguments: Record<string, any>
}

// Message types
export interface ClientMessage extends Omit<VercelMessage, 'tool_calls'> {
    created_at: Date
    tool_calls?: ToolCallPayload[] | null
    tool_results?: ToolResultPayload[] | null
}

export interface ToolResultPayload {
    toolCallId: string
    name: string
    content: string
}

// Database message type
export interface DatabaseMessage {
    id: string
    user_id: string
    chat_id: string
    user_message: string
    assistant_message: string
    tool_calls: Json | null
    tool_results: Json | null
    token_count: number
    created_at: string
    role: 'function' | 'system' | 'user' | 'assistant' | 'data' | 'tool'
}

// Tool types
export interface Tool {
    name: string
    description: string
    parameters: z.ZodObject<any>
    execute: (input: any) => Promise<any>
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

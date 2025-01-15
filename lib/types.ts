import { Json } from '@/lib/database.types'
import { App, ExecutionResult } from '@/lib/schema'
import { Message } from 'ai'
import { z } from 'zod'

// Model types
export interface ModelProvider {
    id: string
    streamText: (params: StreamParams) => Promise<void>
}

export interface AppVersion {
    id: string
    version_id?: string
    app_id: string
    code: string
    version_number: number
    name: string | null
    description: string | null
    created_at: string
    // Optional fields to maintain compatibility
    updated_at?: string
    is_current?: boolean
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
    execute?: (args: Record<string, any>) => Promise<any>
    streamExecution?: (
        args: Record<string, any>,
        signal?: AbortSignal
    ) => AsyncGenerator<ToolStreamResponse>
}

// Add StreamingTool interface
export interface StreamingTool extends Tool {
    streamExecution: (
        args: Record<string, any>,
        signal?: AbortSignal
    ) => AsyncGenerator<ToolStreamResponse>
}

// Add ToolStreamResponse type
export type ToolStreamResponse =
    | {
          type: 'tool-call-streaming-start'
          toolCallId: string
          toolName: string
      }
    | {
          type: 'tool-call-delta'
          toolCallId: string
          argsTextDelta: string
      }
    | {
          type: 'tool-result'
          toolCallId: string
          result: any
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
    id: string
    fileName: string
    fileType: 'csv' | 'json' | 'txt'
    content?: string
    analysis: any
}

// Add this to your existing types
export const RequestSchema = z.object({
    messages: z.array(
        z.object({
            content: z.string(),
            role: z.enum(['user', 'assistant', 'system']),
            createdAt: z.date().optional(),
        })
    ),
    model: z.object({
        id: z.string(),
        provider: z.string(),
        providerId: z.string(),
        name: z.string(),
    }),
    config: z.object({
        model: z.string(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
    }),
    fileId: z.string().optional(),
    fileName: z.string().optional(),
    fileContent: z.string().optional(),
})

export type RequestSchemaType = z.infer<typeof RequestSchema>

export interface VersionMetadata {
    version_id: string
    version_number: number
    app_id: string
    created_at: string
}

export interface CustomMessage extends Message {
    object?: App
    result?: ExecutionResult
    isCodeVisible?: boolean
    steps?: Array<{
        type: string
        finishReason?: string
        [key: string]: any
    }>
}

export interface FileData {
    id: string
    name: string
    type: string
    updated_at: string
    size?: number
    user_id?: string
}

export interface AppData {
    id: string
    name: string
    description: string | null
    updated_at: string
    is_public: boolean
    public_id: string | null
    current_version_id: string | null
    created_at: string
}

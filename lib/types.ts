import { Json } from '@/lib/database.types'
import { App, ExecutionResult } from '@/lib/schema'
import { Message } from 'ai'
import { z } from 'zod'

// Model types
export interface ModelProvider {
    id: string
    provider: string
    modelId: string
    specificationVersion: '1.0'
    defaultObjectGenerationMode: 'json'
    streamText: (params: StreamParams) => Promise<void>
}

export interface AppVersion {
    id: string
    app_id: string
    version_number: number
    code: string
    created_at: string
    updated_at: string
    is_current: boolean
}

export interface StreamParams {
    messages: Message[]
    tools?: Tool[]
    stream?: boolean
    onToken: (token: string) => void
    onToolCall?: (toolInvocation: ToolInvocation) => Promise<void>
}

// Tool types from Vercel AI SDK
export interface ToolCallBase<Name extends string = string, Args = unknown> {
    id: string
    type: 'function'
    function: {
        name: Name
        arguments: Args
    }
}

export interface ToolInvocationBase<Name extends string = string, Result = unknown> {
    toolCallId: string
    state: 'partial-call' | 'call' | 'result'
    toolName: Name
    result?: Result
}

// Streamlit specific types
export interface StreamlitToolArgs {
    query: string
    fileContext?: {
        fileName: string
        fileType: 'csv' | 'json'
        analysis?: any
    }
    chatId: string
}

export interface StreamlitToolResult {
    code: string
    appId: string
    success: boolean
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

export interface ToolInvocation<Name extends string = string, Args = unknown> {
    toolCallId: string
    state: 'partial-call' | 'call' | 'result'
    toolName: Name
    result?: {
        code: string
        appId?: string
        success: boolean
    }
}

export interface ToolCall<Name extends string = string, Args = unknown> {
    id: string
    type: 'function'
    function: {
        name: Name
        arguments: Args
    }
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

export interface ToolResult {
    toolName: string
    content: {
        code: string
        appId?: string
    }
}

export interface ToolState {
    isExecuting: boolean
    toolName: string | null
    progress: number
}

export interface ToolStateStore {
    isExecuting: boolean
    toolName: string | null
    progress: number
    setToolState: (state: Partial<ToolState>) => void
}

export interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

export interface ChatProps {
    messages: Message[]
    isLoading: boolean
    input: string
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    onSubmit: (e: React.FormEvent) => void
    fileUploadState: FileUploadState
    onFileUpload: (file: File) => void
    errorState: Error | null
    onErrorDismiss: () => void
    onChatFinish?: () => void
    onUpdateStreamlit?: (code: string) => void
    onCodeClick?: () => void
    isInChatPage?: boolean
}


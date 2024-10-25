import { Json } from '@/lib/database.types'
import { z } from 'zod'

export interface ToolCall<NAME extends string, ARGS> {
    toolCallId: string;
    toolName: NAME;
    args: ARGS;
}

export interface ToolResult<NAME extends string, ARGS, RESULT> {
    toolCallId: string;
    toolName: NAME;
    args: ARGS;
    result: RESULT;
}

export interface ClientMessage {
    role: 'user' | 'assistant'
    content: string
    created_at?: Date
    tool_calls?: ToolCall<string, any>[] | Json | null
    tool_results?: ToolResult<string, any, any>[] | Json | null
}

export interface Message {
    id: string
    user_id: string
    user_message: string
    assistant_message: string
    tool_calls: Json | null
    tool_results: Json | null
    token_count: number
    created_at: string
}
export type StreamChunk =
    | { type: 'text'; content: string }
    | {
        type: 'tool-call'
        content: { id: string; name: string; parameters: Record<string, any> }
    }
    | {
        type: 'tool-result'
        content: { id: string; name: string; result: any }
    }
    | { type: 'generated_code'; content: string }
    | { type: 'error'; content: string }
    | { type: 'text_chunk'; content: string }
    // Keeping existing types for backward compatibility
    | {
        type:
        | 'text-delta'
        | 'tool-call'
        | 'tool-call-delta'
        | 'tool-call-streaming-start'
        | 'step-finish'
        | 'finish'
        | 'error'
        | 'generated_code'
        | 'message_start'
        | 'content_block_start'
        | 'content_block_delta'
        | 'content_block_stop'
        | 'message_delta'
        | 'message_stop'
        | 'code_explanation'
        | 'tool_use'
        | 'string'
        message?: any
        content_block?: any
        delta?: any
        content?: string
        name?: string
        textDelta?: string
    }

export type CSVAnalysis = {
    totalRows: number
    columns: {
        name: string
        type: string
    }[]
    sampleRows: string[][]
}

export type CreateStreamlitAppTool = {
    query: string
    csvAnalysis: CSVAnalysis
}

export type Tool = {
    name: string
    description: string
    inputSchema: z.ZodObject<any>
    parameters: z.ZodObject<any>
    execute: (input: any) => Promise<any>
}

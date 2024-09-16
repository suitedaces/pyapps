import { Json } from '@/lib/database.types'
import { Anthropic } from '@anthropic-ai/sdk'

export type ToolCall = {
    id?: string
    name: string
    parameters: string
}

export type ToolResult = {
    id?: string
    name: string
    result: any
    error?: any
}

export interface ClientMessage {
    role: 'user' | 'assistant';
    content: string;
    created_at?: Date;
    tool_calls?: ToolCall[] | Json | null;
    tool_results?: ToolResult[] | Json | null;
}

export interface Message {
    id: string
    user_id: string
    role: 'user' | 'assistant'
    user_message: string
    assistant_message: string
    tool_calls: Json | null
    tool_results: Json | null
    token_count: number
    created_at: string
}
export type StreamChunk = {
    type:
        | 'message_start'
        | 'content_block_start'
        | 'content_block_delta'
        | 'content_block_stop'
        | 'message_delta'
        | 'message_stop'
        | 'generated_code'
        | 'code_explanation'
        | 'error'
        | 'tool_use'
    message?: any
    content_block?: any
    delta?: any
    content?: string
    name?: string
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

export type Tool = Anthropic.Messages.Tool

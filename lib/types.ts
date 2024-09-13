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

export type Message = {
    role: 'user' | 'assistant'
    content: string
    tool_calls?: ToolCall[]
    tool_results?: ToolResult[]
    created_at: Date
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

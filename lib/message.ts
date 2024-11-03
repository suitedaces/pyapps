import { Message } from 'ai'
import { ToolInvocation } from './types'

export type MessageContent =
    | { type: 'text'; text: string }
    | { type: 'code'; text: string }
    | { type: 'image'; url: string }
    | { type: 'tool_call'; tool: string; args: Record<string, any> }
    | { type: 'tool_result'; tool: string; result: any }

export interface ChatMessage extends Omit<Message, 'toolInvocations'> {
    id: string
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    createdAt: Date
    toolInvocations?: ToolInvocation[]
}

export interface StreamingMessage {
    id: string
    type: 'text-delta' | 'tool-call' | 'tool-result' | 'error'
    content?: string
    delta?: string
    toolCall?: {
        id: string
        name: string
        args: Record<string, any>
    }
    toolResult?: {
        id: string
        name: string
        result: any
    }
}

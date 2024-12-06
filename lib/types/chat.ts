import { Message } from 'ai'

export interface CustomMessage extends Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    createdAt?: Date
    toolInvocations?: Array<{
        toolName: string
        toolCallId: string
        state: 'start' | 'progress' | 'result'
        result?: string
    }>
} 
import { Message } from "ai"

export type MessageText = {
    type: 'text'
    text: string
}

export type MessageCode = {
    type: 'code'
    text: string
}

export type MessageImage = {
    type: 'image'
    image: string
}

// types.ts
export interface ChatMessage extends Message {
    role: 'function' | 'system' | 'user' | 'assistant' | 'data' | 'tool'
    content: string
}

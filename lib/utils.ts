import {
    CoreMessage,
    CoreToolMessage,
    generateId,
    Message,
    ToolInvocation,
} from 'ai'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { v4 as uuidv4 } from 'uuid'
import { Database } from './database.types'

export interface User {
    id: string
    email: string
    created_at: string
    updated_at: string
}

export interface Chat {
    id: string
    user_id: string
    title: string
    created_at: string
    updated_at: string
    messages: Array<Message>
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface ApplicationError extends Error {
    info: string
    status: number
}

export const fetcher = async (url: string) => {
    const res = await fetch(url)

    if (!res.ok) {
        const error = new Error(
            'An error occurred while fetching the data.'
        ) as ApplicationError

        error.info = await res.json()
        error.status = res.status

        throw error
    }

    return res.json()
}

export function getLocalStorage(key: string) {
    if (typeof window !== 'undefined') {
        return JSON.parse(localStorage.getItem(key) || '[]')
    }
    return []
}

export function generateUUID(): string {
    return uuidv4();
}
function addToolMessageToChat({
    toolMessage,
    messages,
}: {
    toolMessage: CoreToolMessage
    messages: Array<Message>
}): Array<Message> {
    return messages.map((message) => {
        if (message.toolInvocations) {
            return {
                ...message,
                toolInvocations: message.toolInvocations.map(
                    (toolInvocation) => {
                        const toolResult = toolMessage.content.find(
                            (tool) =>
                                tool.toolCallId === toolInvocation.toolCallId
                        )

                        if (toolResult) {
                            return {
                                ...toolInvocation,
                                state: 'result',
                                result: toolResult.result,
                            }
                        }

                        return toolInvocation
                    }
                ),
            }
        }

        return message
    })
}

export function convertToUIMessages(
    messages: Array<CoreMessage>
): Array<Message> {
    return messages.reduce((chatMessages: Array<Message>, message) => {
        if (message.role === 'tool') {
            return addToolMessageToChat({
                toolMessage: message as CoreToolMessage,
                messages: chatMessages,
            })
        }

        let textContent = ''
        let toolInvocations: Array<ToolInvocation> = []

        if (typeof message.content === 'string') {
            textContent = message.content
        } else if (Array.isArray(message.content)) {
            for (const content of message.content) {
                if (content.type === 'text') {
                    textContent += content.text
                } else if (content.type === 'tool-call') {
                    toolInvocations.push({
                        state: 'call',
                        toolCallId: content.toolCallId,
                        toolName: content.toolName,
                        args: content.args,
                    })
                }
            }
        }

        chatMessages.push({
            id: generateId(),
            role: message.role,
            content: textContent,
            toolInvocations,
        })

        return chatMessages
    }, [])
}

export function getTitleFromChat(chat: Chat) {
    const messages = convertToUIMessages(chat.messages as Array<CoreMessage>)
    const firstMessage = messages[0]

    if (!firstMessage) {
        return 'Untitled'
    }

    return firstMessage.content
}

export const truncate = (str: string) => {
    const maxLength = 30 // Adjust this value as needed
    if (str.length <= maxLength) return str
    const extension = str.slice(str.lastIndexOf('.'))
    const nameWithoutExtension = str.slice(0, str.lastIndexOf('.'))
    const truncatedName = nameWithoutExtension.slice(
        0,
        maxLength - 3 - extension.length
    )
    return `${truncatedName}...${extension}`
}

type DatabaseMessage = Database['public']['Tables']['messages']['Row']

export function formatDatabaseMessages(dbMessages: DatabaseMessage[]): Message[] {
    return dbMessages.map(msg => {
        const messages: Message[] = []
        
        // Add user message
        if (msg.user_message) {
            messages.push({
                id: `${msg.id}-user`,
                role: 'user' as const,
                content: msg.user_message,
                createdAt: new Date(msg.created_at)
            })
        }
        
        // Add assistant message with tool results
        if (msg.assistant_message) {
            messages.push({
                id: `${msg.id}-assistant`,
                role: 'assistant' as const,
                content: msg.assistant_message,
                createdAt: new Date(msg.created_at),
                toolInvocations: msg.tool_results 
                    ? (msg.tool_results as any[]).map(tool => ({
                        toolName: 'streamlitTool',
                        toolCallId: tool.id,
                        state: 'result' as const,
                        result: {
                            code: tool.result,
                            appName: tool.app_name || 'No name generated',
                            appDescription: tool.app_description || 'No description generated'
                        }
                    }))
                    : []
            })
        }
        
        return messages
    }).flat()
}

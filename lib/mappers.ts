import { Message as VercelMessage, ToolInvocation as VercelToolInvocation } from 'ai'
import { DatabaseMessage, ClientMessage } from './types'

export function mapDatabaseToVercelMessage(dbMessage: DatabaseMessage): VercelMessage[] {
    const messages: VercelMessage[] = []

    // Map user message if exists
    if (dbMessage.user_message) {
        messages.push({
            id: `${dbMessage.id}-user`,
            role: 'user',
            content: dbMessage.user_message,
            createdAt: new Date(dbMessage.created_at)
        })
    }

    // Map assistant message with tool invocations if exists
    if (dbMessage.assistant_message) {
        const toolInvocations: VercelToolInvocation[] = []

        // Add tool calls if they exist
        if (dbMessage.tool_calls) {
            const calls = JSON.parse(JSON.stringify(dbMessage.tool_calls))
            calls.forEach((call: any) => {
                toolInvocations.push({
                    state: 'call',
                    toolCallId: call.id,
                    toolName: call.name,
                    args: call.parameters
                })
            })
        }

        // Add tool results if they exist
        if (dbMessage.tool_results) {
            const results = JSON.parse(JSON.stringify(dbMessage.tool_results))
            results.forEach((result: any) => {
                toolInvocations.push({
                    state: 'result',
                    toolCallId: result.id,
                    toolName: result.name,
                    args: result.parameters,
                    result: result.content
                })
            })
        }

        messages.push({
            id: `${dbMessage.id}-assistant`,
            role: 'assistant',
            content: dbMessage.assistant_message,
            createdAt: new Date(dbMessage.created_at),
            toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined
        })
    }

    return messages
}

export function mapVercelToClientMessage(vercelMessage: VercelMessage): ClientMessage {
    return {
        id: vercelMessage.id,
        role: vercelMessage.role as ClientMessage['role'],
        content: vercelMessage.content,
        createdAt: vercelMessage.createdAt ? new Date(vercelMessage.createdAt) : new Date(),
        toolInvocations: vercelMessage.toolInvocations as unknown as ClientMessage['toolInvocations']
    }
}

export function mapVercelToDatabaseMessage(
    chatId: string,
    userId: string,
    vercelMessage: VercelMessage
): Partial<DatabaseMessage> {
    // Extract tool calls and results from toolInvocations
    const toolCalls = vercelMessage.toolInvocations
        ?.filter(t => t.state === 'call')
        .map(t => ({
            id: t.toolCallId,
            name: t.toolName,
            parameters: t.args
        })) || null

    const toolResults = vercelMessage.toolInvocations
        ?.filter(t => t.state === 'result')
        .map(t => ({
            id: t.toolCallId,
            name: t.toolName,
            content: t.result
        })) || null

    return {
        chat_id: chatId,
        user_id: userId,
        user_message: vercelMessage.role === 'user' ? vercelMessage.content : '',
        assistant_message: vercelMessage.role === 'assistant' ? vercelMessage.content : '',
        tool_calls: toolCalls,
        tool_results: toolResults,
        created_at: vercelMessage.createdAt ? new Date(vercelMessage.createdAt).toISOString() : new Date().toISOString(),
        role: vercelMessage.role as DatabaseMessage['role']
    }
}

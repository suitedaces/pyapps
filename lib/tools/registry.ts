import { StreamingTool, ToolStreamResponse } from './types'

export class ToolManager {
    private static instance: ToolManager
    private tools: Map<string, StreamingTool> = new Map()
    private activeToolCalls: Map<
        string,
        {
            tool: StreamingTool
            startTime: number
            abortController: AbortController
            lastStreamTime: number
        }
    > = new Map()

    private constructor() {}

    static getInstance(): ToolManager {
        if (!ToolManager.instance) {
            ToolManager.instance = new ToolManager()
        }
        return ToolManager.instance
    }

    register(tool: StreamingTool): void {
        this.tools.set(tool.toolName, tool)
        console.log(`🔧 Registered tool: ${tool.toolName}`)
    }

    get(toolName: string): StreamingTool | undefined {
        return this.tools.get(toolName)
    }

    getAllTools(): StreamingTool[] {
        return Array.from(this.tools.values())
    }

    private async rateLimit(toolCallId: string, minInterval = 10): Promise<void> {
        const toolCall = this.activeToolCalls.get(toolCallId)
        if (!toolCall) return

        const now = Date.now()
        const elapsed = now - toolCall.lastStreamTime

        if (elapsed < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - elapsed))
        }

        toolCall.lastStreamTime = Date.now()
    }

    async *streamToolExecution(
        toolCallId: string,
        toolName: string,
        args: Record<string, any>
    ): AsyncGenerator<ToolStreamResponse> {
        const tool = this.tools.get(toolName)
        if (!tool) {
            throw new Error(`Tool "${toolName}" not found`)
        }

        try {
            const abortController = new AbortController()
            this.activeToolCalls.set(toolCallId, {
                tool,
                startTime: Date.now(),
                abortController,
                lastStreamTime: Date.now()
            })

            yield {
                type: 'tool-call-streaming-start',
                toolCallId,
                toolName,
            }

            for await (const part of tool.streamExecution(args, abortController.signal)) {
                await this.rateLimit(toolCallId)
                yield part
            }

        } catch (error) {
            console.error('❌ Tool execution error:', {
                toolName,
                toolCallId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
            throw error
        } finally {
            this.activeToolCalls.delete(toolCallId)
        }
    }

    abortToolExecution(toolCallId: string): void {
        const toolCall = this.activeToolCalls.get(toolCallId)
        if (toolCall) {
            toolCall.abortController.abort()
            this.activeToolCalls.delete(toolCallId)
        }
    }
}

export const toolManager = ToolManager.getInstance()

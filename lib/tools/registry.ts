import { StreamingTool, ToolStreamResponse } from './types'
import debug from 'debug'

// Simplified logger with essential channels
interface ToolLogger {
    info: debug.Debugger & { color?: string }
    error: debug.Debugger & { color?: string }
}

const log: ToolLogger = {
    info: debug('tools:info'),
    error: debug('tools:error')
}

// Set colors directly
log.info.color = '36'   // cyan
log.error.color = '31'  // red

// Simplified config with essential settings
interface RateLimitConfig {
    minInterval: number
    maxConcurrent: number
}

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

    // Simplified rate limit config
    private rateLimitConfig: RateLimitConfig = {
        minInterval: 10,
        maxConcurrent: 5
    }

    private currentConcurrent: number = 0

    private constructor() {
        log.info('🔧 ToolManager initialized')
    }

    static getInstance(): ToolManager {
        if (!ToolManager.instance) {
            ToolManager.instance = new ToolManager()
        }
        return ToolManager.instance
    }

    register(tool: StreamingTool): void {
        this.tools.set(tool.toolName, tool)
        log.info(`Registered tool: ${tool.toolName}`)
    }

    get(toolName: string): StreamingTool | undefined {
        return this.tools.get(toolName)
    }

    getAllTools(): StreamingTool[] {
        return Array.from(this.tools.values())
    }

    // Simplified rate limiting
    private async rateLimit(toolCallId: string): Promise<void> {
        if (this.currentConcurrent >= this.rateLimitConfig.maxConcurrent) {
            throw new Error('Too many concurrent requests')
        }

        this.currentConcurrent++

        try {
            const toolCall = this.activeToolCalls.get(toolCallId)
            if (!toolCall) return

            const elapsed = Date.now() - toolCall.lastStreamTime
            if (elapsed < this.rateLimitConfig.minInterval) {
                await new Promise(resolve =>
                    setTimeout(resolve, this.rateLimitConfig.minInterval - elapsed)
                )
            }

            toolCall.lastStreamTime = Date.now()
        } finally {
            this.currentConcurrent--
        }
    }

    async *streamToolExecution(
        toolCallId: string,
        toolName: string,
        args: Record<string, any>
    ): AsyncGenerator<ToolStreamResponse> {
        log.info('Starting execution: %s (%s)', toolCallId, toolName)

        try {
            const tool = this.tools.get(toolName)
            if (!tool) {
                throw new Error(`Tool "${toolName}" not found`)
            }

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
                if (abortController.signal.aborted) {
                    throw new Error('Stream aborted by user')
                }

                try {
                    await this.rateLimit(toolCallId)
                    yield part
                } catch (error) {
                    log.error('Error during execution: %s', error)
                    throw error
                }
            }

            log.info('Execution completed: %s', toolCallId)

        } catch (error) {
            log.error('Execution failed: %s - %s', toolCallId, error)
            throw error
        } finally {
            this.cleanup(toolCallId)
        }
    }

    private cleanup(toolCallId: string): void {
        this.activeToolCalls.delete(toolCallId)
    }

    abortToolExecution(toolCallId: string): void {
        const toolCall = this.activeToolCalls.get(toolCallId)
        if (toolCall) {
            toolCall.abortController.abort()
            this.cleanup(toolCallId)
        }
    }

    async validateToolCall(
        toolName: string,
        args: Record<string, any>
    ): Promise<{ valid: boolean; error?: string }> {
        const tool = this.tools.get(toolName)
        if (!tool) {
            return {
                valid: false,
                error: `Tool "${toolName}" not found`
            }
        }

        try {
            await tool.parameters.parseAsync(args)
            return { valid: true }
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Invalid arguments'
            }
        }
    }
}

export const toolManager = ToolManager.getInstance()

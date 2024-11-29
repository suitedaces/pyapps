import { z } from 'zod'
import { StreamingTool, ToolCallState, ToolStreamResponse } from './types'

export abstract class BaseStreamingTool implements StreamingTool {
    abstract toolName: string
    abstract description: string
    abstract parameters: z.ZodSchema

    protected state: Map<string, ToolCallState> = new Map()

    abstract streamExecution(
        args: any,
        signal?: AbortSignal
    ): AsyncGenerator<ToolStreamResponse>

    protected createToolCallDelta(
        toolCallId: string,
        delta: string
    ): ToolStreamResponse {
        return {
            type: 'tool-call-delta',
            toolCallId,
            argsTextDelta: delta,
        }
    }

    protected createToolResult(
        toolCallId: string,
        result: any
    ): ToolStreamResponse {
        return {
            type: 'tool-result',
            toolCallId,
            result,
        }
    }

    protected updateState(toolCallId: string, update: Partial<ToolCallState>) {
        const currentState = this.state.get(toolCallId) || {
            toolCallId,
            toolName: this.toolName,
            args: {},
            status: 'starting',
        }

        this.state.set(toolCallId, {
            ...currentState,
            ...update,
        })
    }

    protected async *streamContent(
        toolCallId: string,
        content: string,
        chunkSize: number = 100,
        signal?: AbortSignal
    ): AsyncGenerator<ToolStreamResponse> {
        this.updateState(toolCallId, { status: 'streaming' })

        let offset = 0
        while (offset < content.length && !signal?.aborted) {
            const chunk = content.slice(offset, offset + chunkSize)
            yield this.createToolCallDelta(toolCallId, chunk)
            offset += chunkSize
        }

        if (signal?.aborted) {
            yield this.createToolResult(toolCallId, { error: 'Stream aborted' })
        }
    }

    protected async validateArgs(args: any): Promise<void> {
        try {
            await this.parameters.parseAsync(args)
        } catch (error) {
            throw new Error(`Invalid arguments for ${this.toolName}: ${error}`)
        }
    }

    protected cleanup(toolCallId: string) {
        this.state.delete(toolCallId)
    }

    protected reportProgress(
        toolCallId: string,
        progress: number,
        status?: string
    ): ToolStreamResponse {
        this.updateState(toolCallId, {
            status: 'streaming',
            metadata: {
                progress,
                status: status || `Progress: ${progress}%`,
            },
        })

        return {
            type: 'tool-call-delta',
            toolCallId,
            argsTextDelta: JSON.stringify({
                progress,
                status: status || `Progress: ${progress}%`,
            }),
        }
    }
}

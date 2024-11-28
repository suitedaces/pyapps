import { z } from 'zod'
import { StreamingTool, ToolStreamResponse, ToolCallState } from './types'

export abstract class BaseStreamingTool implements StreamingTool {
  abstract toolName: string;
  abstract description: string;
  abstract parameters: z.ZodSchema;

  protected state: Map<string, ToolCallState> = new Map();
  private rateLimiter = new Map<string, number>();

  abstract streamExecution(
    args: any,
    signal?: AbortSignal
  ): AsyncGenerator<ToolStreamResponse>;

  // Helper methods for creating protocol-compliant responses
  protected createToolCallStart(toolCallId: string): ToolStreamResponse {
    console.log('🚀 Creating tool call start:', { toolCallId, toolName: this.toolName });
    return {
      type: 'tool-call-streaming-start',
      toolCallId,
      toolName: this.toolName
    };
  }

  protected createToolCallDelta(toolCallId: string, delta: string): ToolStreamResponse {
    console.log('📝 Creating tool call delta:', {
      toolCallId,
      deltaLength: delta.length,
      preview: delta.substring(0, 50) + '...'
    });
    return {
      type: 'tool-call-delta',
      toolCallId,
      argsTextDelta: delta
    };
  }

  protected createToolResult(toolCallId: string, result: any): ToolStreamResponse {
    console.log('✅ Creating tool result:', {
      toolCallId,
      resultType: typeof result,
      preview: typeof result === 'string' ? result.substring(0, 50) + '...' : undefined
    });
    return {
      type: 'tool-result',
      toolCallId,
      result
    };
  }

  protected updateState(toolCallId: string, update: Partial<ToolCallState>) {
    const currentState = this.state.get(toolCallId) || {
      toolCallId,
      toolName: this.toolName,
      args: {},
      status: 'starting'
    };

    this.state.set(toolCallId, {
      ...currentState,
      ...update
    });

    console.log('🔄 State updated:', {
      toolCallId,
      status: update.status || currentState.status
    });
  }

  protected async *streamWithRateLimit(
    toolCallId: string,
    content: string,
    chunkSize: number = 100,
    signal?: AbortSignal
  ): AsyncGenerator<ToolStreamResponse> {
    this.updateState(toolCallId, { status: 'streaming' });
    console.log('🔄 Starting rate-limited streaming:', {
      toolCallId,
      contentLength: content.length,
      chunkSize
    });

    let offset = 0;
    while (offset < content.length && !signal?.aborted) {
      await this.rateLimit(toolCallId);
      const chunk = content.slice(offset, offset + chunkSize);
      yield this.createToolCallDelta(toolCallId, chunk);
      offset += chunkSize;
    }

    if (signal?.aborted) {
      console.log('⚠️ Stream aborted:', { toolCallId });
      yield this.createToolResult(toolCallId, { error: 'Stream aborted' });
    }
  }

  private async rateLimit(toolCallId: string, minInterval = 10): Promise<void> {
    const now = Date.now();
    const lastTime = this.rateLimiter.get(toolCallId) || 0;
    const elapsed = now - lastTime;

    if (elapsed < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
    }

    this.rateLimiter.set(toolCallId, Date.now());
  }

  protected async validateArgs(args: any): Promise<void> {
    try {
      await this.parameters.parseAsync(args);
      console.log('✅ Arguments validated successfully');
    } catch (error) {
      console.error('❌ Argument validation failed:', error);
      throw new Error(`Invalid arguments for ${this.toolName}: ${error}`);
    }
  }

  protected cleanup(toolCallId: string) {
    this.state.delete(toolCallId);
    this.rateLimiter.delete(toolCallId);
    console.log('🧹 Cleanup completed:', { toolCallId });
  }

  protected reportProgress(
    toolCallId: string,
    progress: number,
    status?: string
  ): ToolStreamResponse {
    console.log('📊 Progress update:', { toolCallId, progress, status });

    // Update internal state with progress in metadata
    this.updateState(toolCallId, {
      status: 'streaming',
      metadata: {
        progress,
        status: status || `Progress: ${progress}%`
      }
    });

    // Create progress message according to Vercel's protocol
    const progressMessage = JSON.stringify({
      progress,
      status: status || `Progress: ${progress}%`
    });

    // Return a proper tool-call-delta according to Vercel's protocol
    return {
      type: 'tool-call-delta',
      toolCallId,
      argsTextDelta: progressMessage
    };
  }
}

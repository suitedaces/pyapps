import { StreamingTool, ToolStreamResponse } from './types'

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, StreamingTool> = new Map();
  private activeToolCalls: Map<string, {
    tool: StreamingTool;
    startTime: number;
    abortController: AbortController;
  }> = new Map();

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: StreamingTool): void {
    if (this.tools.has(tool.toolName)) {
      console.warn(`Tool ${tool.toolName} is being re-registered`);
    }
    this.tools.set(tool.toolName, tool);
    console.log(`🔧 Registered tool: ${tool.toolName}`);
  }

  get(toolName: string): StreamingTool | undefined {
    return this.tools.get(toolName);
  }

  getAllTools(): StreamingTool[] {
    return Array.from(this.tools.values());
  }

  // Track active tool calls for monitoring and cleanup
  private startToolCall(toolCallId: string, tool: StreamingTool): void {
    this.activeToolCalls.set(toolCallId, {
      tool,
      startTime: Date.now(),
      abortController: new AbortController()
    });
  }

  private endToolCall(toolCallId: string): void {
    const toolCall = this.activeToolCalls.get(toolCallId);
    if (toolCall) {
      const duration = Date.now() - toolCall.startTime;
      console.log(`✅ Tool call completed: ${toolCallId} (${duration}ms)`);
      this.activeToolCalls.delete(toolCallId);
    }
  }

  // Helper method to validate tool existence and parameters
  async validateToolCall(
    toolName: string,
    args: Record<string, any>
  ): Promise<{ valid: boolean; error?: string }> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        valid: false,
        error: `Tool "${toolName}" not found`
      };
    }

    try {
      // Validate args against tool's schema
      await tool.parameters.parseAsync(args);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid arguments for tool "${toolName}": ${error}`
      };
    }
  }

  // Stream handler that manages tool execution states
  async *streamToolExecution(
    toolCallId: string,
    toolName: string,
    args: Record<string, any>
  ): AsyncGenerator<ToolStreamResponse> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`);
    }

    try {
      console.log('🚀 Starting tool execution:', { toolCallId, toolName });
      this.startToolCall(toolCallId, tool);

      yield {
        type: 'tool-call-streaming-start',
        toolCallId,
        toolName
      };

      const abortController = this.activeToolCalls.get(toolCallId)?.abortController;
      if (!abortController) {
        throw new Error('AbortController not found for tool call');
      }

      let collectedContent = '';
      for await (const part of tool.streamExecution(args, abortController.signal)) {
        console.log('📦 Processing tool stream part:', {
          type: part.type,
          toolCallId: part.toolCallId,
          contentLength: 'argsTextDelta' in part ? part.argsTextDelta.length : undefined
        });

        if (part.type === 'tool-call-delta') {
          collectedContent += part.argsTextDelta;
        }

        yield part;
      }

      console.log('✅ Tool execution completed:', {
        toolCallId,
        contentLength: collectedContent.length,
        preview: collectedContent.substring(0, 100) + '...'
      });

      // Send final result
      yield {
        type: 'tool-result',
        toolCallId,
        result: collectedContent
      } as ToolStreamResponse;

    } catch (error) {
      console.error('❌ Tool execution error:', {
        toolName,
        toolCallId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      this.endToolCall(toolCallId);
    }
  }

  // Method to abort streaming
  abortToolExecution(toolCallId: string): void {
    const toolCall = this.activeToolCalls.get(toolCallId);
    if (toolCall) {
      toolCall.abortController.abort();
      this.endToolCall(toolCallId);
    }
  }
}

// Export singleton instance
export const toolRegistry = ToolRegistry.getInstance();

import { z } from 'zod'

export type ToolCallStreamingPart = {
  type: 'tool-call-streaming-start';
  toolCallId: string;
  toolName: string;
}

export type ToolCallPart = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
}

export type ToolCallDeltaPart = {
  type: 'tool-call-delta';
  toolCallId: string;
  argsTextDelta: string;
}

export type ToolResultPart = {
  type: 'tool-result';
  toolCallId: string;
  result: any;
}

export type ToolStreamResponse =
  | ToolCallStreamingPart
  | ToolCallPart
  | ToolCallDeltaPart
  | ToolResultPart;

export interface StreamingTool {
  toolName: string;
  description: string;
  parameters: z.ZodSchema;
  streamExecution: (args: any, signal?: AbortSignal) => AsyncGenerator<ToolStreamResponse>;
}

export type ToolCallState = {
  toolCallId: string;
  toolName: string;
  args: any;
  status: 'starting' | 'streaming' | 'complete' | 'error';
  progress?: number;
  metadata?: {
    progress?: number;
    status?: string;
    [key: string]: any;
  };
  error?: string;
}

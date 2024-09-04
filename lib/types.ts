export type Message = {
    role: 'user' | 'assistant'
    content: string
}

export type StreamChunk = {
    type: 'message_start' | 'message_delta' | 'message_stop' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'tool_calls';
    delta?: {
        type: 'text_delta';
        text: string;
    };
    tool_calls?: ToolCall[];
}

export type ToolCall = {
    function: {
        name: string;
        arguments: string;
    };
}

export interface CSVAnalysis {
    totalRows: number;
    columns: {
        name: string;
        type: string;
    }[];
    sampleRows: string[][];
}
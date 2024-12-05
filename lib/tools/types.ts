import { CoreTool, ToolExecutionOptions } from 'ai'
import { z } from 'zod'

// Simplified tool types
export type ToolResult = {
    content: string
    metadata?: Record<string, any>
}

export interface CustomToolOptions extends ToolExecutionOptions {
    fileContext?: {
        fileName: string
        fileType: string
        content?: string
        analysis?: any
    }
}

export type Tool = {
    toolName: string
    description: string
    schema: z.ZodObject<any>
    execute: (args: any, options: CustomToolOptions) => Promise<ToolResult>
}
// Streamlit specific types
export const streamlitAppSchema = z.object({
    query: z.string().min(1, 'Query cannot be empty'),
    fileContext: z
        .object({
            fileName: z.string(),
            fileType: z.enum(['csv', 'json']),
            analysis: z.any().optional(),
        })
        .optional(),
})

export type StreamlitToolArgs = z.infer<typeof streamlitAppSchema>

import { z } from 'zod'

// Schema for file context
export const fileContextSchema = z
    .object({
        fileName: z.string(),
        fileType: z.enum(['csv', 'json']),
        analysis: z.any().optional(),
    })
    .optional()

// Schema for Streamlit tool result
export const streamlitResultSchema = z.object({
    code: z.string(),
    requiredLibraries: z.array(z.string())
})

// Schema for Streamlit tool arguments
export const streamlitAppSchema = z.object({
    query: z
        .string()
        .min(1, 'Query cannot be empty')
        .describe(
            'Explain the requirements for the Streamlit code you want to generate'
        ),
    fileContext: fileContextSchema,
})

export type StreamlitToolArgs = z.infer<typeof streamlitAppSchema>
export type StreamlitToolResult = z.infer<typeof streamlitResultSchema>

import { z } from 'zod'

export const ExecutionResultSchema = z.object({
    status: z.enum(['success', 'error']),
    output: z.string().optional(),
    error: z.string().optional(),
})

export const AppSchema = z.object({
    title: z.string().describe('Short title of the app. Max 3 words.'),
    description: z
        .string()
        .describe('Short description of what the app does. Max 1 sentence.'),
    // type: z.enum(['web', 'api', 'cli', 'mobile']).describe('Type of application being generated'),
    //   template: z.string().describe('Name of the template used to generate the app.'),
    file_path: z.string().describe('Relative path to the main file'),
    code: z.string().describe('Generated runnable code'),
    additional_dependencies: z
        .array(z.string())
        .describe('Additional dependencies required by the app'),
    has_additional_dependencies: z
        .boolean()
        .describe('Whether additional dependencies are required'),
    install_dependencies_command: z
        .string()
        .describe('Command to install additional dependencies'),
})

export const MessageContentSchema = z.object({
    type: z.enum(['text', 'code']),
    content: z.string(),
    app: AppSchema.optional(),
})

export const MessageSchema = z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.array(MessageContentSchema),
    createdAt: z.date(),
    object: AppSchema.optional(),
    result: ExecutionResultSchema.optional(),
})

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>
export type App = z.infer<typeof AppSchema>
export type MessageContent = z.infer<typeof MessageContentSchema>
export type ChatMessage = z.infer<typeof MessageSchema>

import { tool, CoreTool } from "ai"
import { z } from "zod"

const suggestionsToolSchema = z.object({
    metrics: z.array(z.string()).max(5, 'Only suggest up to 5 metrics').min(1, 'Suggest at least 1 metric').describe('Suggest metrics to the user based on the file in context, do not use this tool if there is no mention of a file being uploaded')
})

export const suggestionsTool: CoreTool<typeof suggestionsToolSchema, {
    metrics: string[]
}> = tool({
    parameters: suggestionsToolSchema,
    execute: async ({ metrics }) => {
        console.log('🚀 Generated Metrics:', metrics)
        return { metrics }
    }
})
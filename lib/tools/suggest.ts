import { tool } from 'ai'
import { z } from 'zod'

const SuggestionsSchema = z.object({
    keyMetrics: z
        .array(z.string().min(1).trim())
        .min(1, 'At least one metric is required')
        .max(3)
        .describe("Key metrics to calculate from numeric and categorical columns. Focus on aggregations, trends, and distributions. Example: ['Average sales by category', 'Monthly growth rate', 'Distribution of ratings']"),

    keyQuestions: z
        .array(z.string().min(1).trim())
        .min(1, 'At least one question is required')
        .max(5)
        .describe("Analytical questions that explore relationships between columns, identify patterns, or highlight insights. Example: ['How do sales correlate with customer ratings?', 'Which categories show the strongest growth?']")
}).strict().describe("Will be displayed to the user as multi-select to choose from")

type SuggestionsInput = z.infer<typeof SuggestionsSchema>
type SuggestionsOutput = {
    success: boolean
}

export const suggestionsTool = tool<typeof SuggestionsSchema, SuggestionsOutput>({
    parameters: SuggestionsSchema,
    execute: async ({
        keyMetrics,
        keyQuestions,
    }: SuggestionsInput) => {
        try {
            console.log(keyMetrics, keyQuestions)
            return {
                success: true
            }
        } catch (error) {
            console.error('Suggestions generation error:', error)
            throw error
        }
    },
})
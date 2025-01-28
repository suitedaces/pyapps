import { tool } from 'ai'
import { z } from 'zod'

const SuggestionsSchema = z.object({
    keyMetrics: z
        .array(z.string().min(1).trim())
        .min(1, 'At least one metric is required')
        .max(3)
        .describe("Key metrics to calculate from numeric and categorical columns. Focus on aggregations, trends, and distributions. Example: ['Average sales by category', 'Monthly growth rate', 'Distribution of ratings']"),

    keyQuestions: z
        .array(z.string().min(1).trim().describe("Suggest analytical question based on column relationships (e.g., 'How does X correlate with Y?', 'What is the distribution of Z?')"))
        .min(1, 'At least one question is required')
        .max(5),

    userInteractions: z.object({
        filters: z
            .array(z.string().min(3).trim().describe("Suggest filter based on file attributes (e.g: 'Filter by extension', 'Filter by date modified'"))
            .min(1)
            .max(5),
            
        drilldowns: z
            .array(z.string().min(3).trim().describe("Suggest way to explore detailed data views (e.g., 'Group by category', 'Breakdown by time period')"))
            .min(1)
            .max(5),
        search: z
            .array(z.string().min(3).trim().describe("Suggest search capabilities for the dataset (e.g., 'Search within text columns', 'Find specific values')"))
            .min(1)
            .max(5)
    }).describe("Interactive features for exploring dataset columns"),
}).strict()

type SuggestionsInput = z.infer<typeof SuggestionsSchema>
type SuggestionsOutput = {
    success: boolean
}

export const suggestionsTool = tool<typeof SuggestionsSchema, SuggestionsOutput>({
    parameters: SuggestionsSchema,
    execute: async ({
        keyMetrics,
        keyQuestions,
        userInteractions,
    }: SuggestionsInput) => {
        try {
            console.log(keyMetrics, keyQuestions, userInteractions)
            return {
                success: true
            }
        } catch (error) {
            console.error('Suggestions generation error:', error)
            throw error
        }
    },
})
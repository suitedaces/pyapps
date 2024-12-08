import { z } from 'zod'
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export const streamlitTool = {
    description: 'Generate a Streamlit app with data visualization',
    parameters: z.object({
        dataDescription: z.string().optional().describe('If a file exists, description of the data, column names, and insights about the data that the user is interested in.'),
        query: z.string().describe('Detailed requirmements of a complex Streamlit app.'),
        fileDirectory: z
            .string()
            .regex(/^\/app\/s3\/data\/.+\/$/, 'Must be in the format "/app/s3/data/<fileNameWithExtension/>"')
            .optional()
            .describe('Should always be in the format "/app/s3/data/<fileNameWithExtension/>"'),
    }),
    execute: async ({ dataDescription, query, fileDirectory }: z.infer<typeof streamlitTool.parameters>): Promise<{ code: string, appName: string, appDescription: string }> => {
        console.log('Starting streamlitTool execution:', { query, fileDirectory })

        try {
            console.log('Generating Streamlit code with Claude...')
            const { object: { code, appName, appDescription } } = await generateObject({
                model: anthropic('claude-3-5-sonnet-20241022'),
                schema: z.object({
                    code: z.string().describe('ONLY the generated Streamlit code. Do not include any other text.'),
                    appName: z.string().describe('Name of the app you created.'),
                    appDescription: z.string().describe('Short description of the app you created.')
                }),
                messages: [
                    {
                        role: 'system',
                        content: `Generate a Streamlit app based on the query.
                        ${fileDirectory ? `ONLY use the file at path "${fileDirectory}"` : ''}
                        ${dataDescription ? `Here's some information about the data: ${dataDescription}` : ''}
                        Include all necessary imports. Only respond with code.`
                    },
                    { role: 'user', content: query }
                ]
            })
            
            console.log('Generated Streamlit code:', {
                promptLength: query.length,
                codeLength: code.length,
                firstLines: code.split('\n').slice(0, 3).join('\n'),
                appName,
                appDescription
            })

            return { code, appName, appDescription }

        } catch (error) {
            console.error('Error in streamlit tool:', {
                error,
                query,
                dataDescription,
                fileDirectory
            })
            throw error
        }
    }
}
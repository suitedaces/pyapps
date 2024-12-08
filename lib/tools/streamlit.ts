import { z } from 'zod'
import { generateObject, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { Tool } from 'ai'

export const streamlitTool = tool({
    name: 'streamlitTool',
    description: 'Generate a Streamlit app with data visualization',
    parameters: z.object({
        dataDescription: z.string().max(1000, 'Please be concise, less words, more details.').optional().describe('If a file exists, description of the data, column names, and insights about the data that the user is interested in.'),
        query: z.string().max(1000, 'Please be concise and to the point, yet detailed.').describe('Detailed instructions on what the user may want to see in the Streamlit app. NOT the actual code.'),
        fileDirectory: z
            .string()
            .regex(/^\/app\/s3\/data\/.+\/$/, 'Must be in the format "/app/s3/data/<fileNameWithExtension/>"')
            .optional()
            .describe('Should always be in the format "/app/s3/data/<fileNameWithExtension/>"'),
    }),
    execute: async ({ dataDescription, query, fileDirectory }) => {
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
                        content: `You are a Python code generation assistant specializing in Streamlit apps.
Generate a complete, runnable Streamlit app based on the given query.
${fileDirectory ? `You're working with a file at path "/app/s3/data/${fileDirectory}". 
IMPORTANT: Always use the FULL PATH "/app/s3/data/<filename>" when reading files.
DO NOT use relative paths, always use the absolute path starting with "/app/s3/data/` : ''}
DO NOT use "st.experimental_rerun()" at any cost.
Only respond with the code, no potential errors, no explanations!
Include all necessary imports at the beginning of the file.`.replace(/\n/g, ' ')
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
})
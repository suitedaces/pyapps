import { z } from 'zod'
import { tool, CoreTool } from 'ai'


const streamlitToolSchema = z.object({
    code: z.string()
        .describe('Complete, runnable Streamlit app code including all necessary imports. If the user has data, code should use the path "/app/s3/data/<filenamewithextension>" to read the data.'),
    requiredLibraries: z.array(z.string())
        .describe('List of Python package dependencies required to run the Streamlit app'),
    appName: z.string()
        .describe('Descriptive name for the Streamlit application'),
    appDescription: z.string()
        .max(200, 'Keep description concise')
        .describe('Brief summary of the app\'s functionality and purpose')
})

export const streamlitTool: CoreTool<z.ZodObject<{
    code: z.ZodString,
    requiredLibraries: z.ZodArray<z.ZodString>,
    appName: z.ZodString,
    appDescription: z.ZodString
}>, {
    code: string,
    requiredLibraries: string[],
    appName: string,
    appDescription: string
}> = tool({
    parameters: streamlitToolSchema,
    execute: async ({ code, requiredLibraries, appName, appDescription }) => {
        console.log('Generated Streamlit code:', {
            codeLength: code.length,
            firstLines: code.split('\n').slice(0, 3).join('\n'),
            appName,
            appDescription
        })
        return {
            code,
            requiredLibraries,
            appName,
            appDescription
        }
    }
})
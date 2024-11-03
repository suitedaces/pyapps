import { Anthropic } from '@anthropic-ai/sdk'
import { z } from 'zod'
import { Tool, ToolInvocation } from './types'

const codeGenerationAnthropicAgent = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

// Define tool schemas using Zod
const streamlitAppSchema = z.object({
    query: z
        .string()
        .min(1, 'Query cannot be empty')
        .describe(
            'Explain the requirements for the Streamlit code you want to generate. Include details about the data if there\'s any context and the column names VERBATIM as a list, with any spaces or special chars like this: ["col 1 ", " 2col 1"].'
        ),
})

const jupyterNotebookSchema = z.object({
    code: z
        .string()
        .describe('The Python code to execute in the Jupyter Notebook'),
})

export const tools: Tool[] = [
    {
        name: 'create_streamlit_app',
        description: 'Generates Python (Streamlit) code based on a given query',
        parameters: streamlitAppSchema,
        execute: async (input) => {
            const { query } = streamlitAppSchema.parse(input)
            return generateCode(query)
        },

        // {
        //     name: 'execute_jupyter_notebook',
        //     description: 'Executes Python code in a Jupyter Notebook',
        //     inputSchema: jupyterNotebookSchema,
        // parameters: jupyterNotebookSchema,
        //     execute: async (input) => {
        //         const { code } = jupyterNotebookSchema.parse(input)
        //         return generateCode(code)
        //     },
        // },
    },
]

// Improved code generation with better error handling
export async function generateCode(
    query: string
): Promise<{ generatedCode: string; codeTokenCount: number }> {
    if (!query?.trim()) {
        throw new Error('Query cannot be empty')
    }

    console.log('🔍 Generating code for query:', query)

    try {
        const response = await codeGenerationAnthropicAgent.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 2000,
            temperature: 0.7,
            system: 'You are a Python code generation assistant specializing in Streamlit apps. These are the packages installed where your code will run: [streamlit, pandas, numpy, matplotlib, requests, seaborn, plotly]. Generate a complete, runnable Streamlit app based on the given query. DO NOT use "st.experimental_rerun()" at any cost. Only respond with the code, no potential errors, no explanations!',
            messages: [{ role: 'user', content: query }],
        })

        if (Array.isArray(response.content) && response.content.length > 0) {
            const generatedCode =
                response.content[0].type === 'text'
                    ? response.content[0].text
                          .replace(/^```python/, '')
                          .replace(/```$/, '')
                          .trim()
                    : ''

            console.log('✨ Code generated successfully')
            return {
                generatedCode,
                codeTokenCount:
                    response.usage.input_tokens + response.usage.output_tokens,
            }
        }

        throw new Error('Unexpected response format from code generation')
    } catch (error) {
        console.error('❌ Error generating code:', error)
        throw error
    }
}

// Helper functions for tool management
export function getToolByName(name: string): Tool | undefined {
    return tools.find((tool) => tool.name === name)
}

export async function executeToolCall(
    toolInvocation: ToolInvocation
): Promise<any> {
    const tool = getToolByName(toolInvocation.toolName)
    if (!tool) {
        throw new Error(`Tool not found: ${toolInvocation.toolName}`)
    }

    try {
        console.log(`🔧 Executing tool: ${toolInvocation.toolName}`)
        const result = await tool.execute(toolInvocation.args)
        console.log(`✅ Tool execution completed: ${toolInvocation.toolName}`)
        return result
    } catch (error) {
        console.error(
            `❌ Error executing tool ${toolInvocation.toolName}:`,
            error
        )
        throw error
    }
}

// Type guard for tool validation
export function isValidTool(tool: any): tool is Tool {
    return (
        typeof tool === 'object' &&
        tool !== null &&
        'name' in tool &&
        'description' in tool &&
        'parameters' in tool &&
        'execute' in tool &&
        typeof tool.execute === 'function'
    )
}


// create_streamlit_app: async (input: { query: string }): Promise<string> => {
//     try {
//         const { generatedCode, codeTokenCount } = await generateCode(
//             input.query
//         )

//         return generatedCode
//     } catch (err) {
//         console.error(`Error generating Streamlit app:`, err)
//         return `Error generating Streamlit app for query: ${input.query}`
//     }
// },
// execute_jupyter_notebook: async (input: {
//     code: string
// }): Promise<string> => {
//     try {
//         const results = await runNotebook(input.code)
//         return JSON.stringify(results)
//     } catch (err) {
//         console.error(`Error executing Jupyter Notebook:`, err)
//         return `Error executing Jupyter Notebook for code: ${input.code}`
//     }
// },
// }

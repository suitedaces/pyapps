import { Anthropic } from '@anthropic-ai/sdk'
import { z } from 'zod'
import { Tool, ToolInvocation } from './types'

const codeGenerationAnthropicAgent = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

// Define tool schema using Zod
const streamlitAppSchema = z.object({
    query: z
        .string()
        .min(1, 'Query cannot be empty')
        .describe(
            'Explain the requirements for the Streamlit code you want to generate. Include details about the data if there\'s any context and the column names VERBATIM as a list, with any spaces or special chars like this: ["col 1 ", " 2col 1"].'
        ),
    fileContext: z.object({
        fileName: z.string(),
        fileType: z.enum(['csv', 'json']),
        analysis: z.any().optional(),
    }).optional(),
})

export const tools: Tool[] = [
    {
        toolName: 'create_streamlit_app',
        description: 'Generates Python (Streamlit) code based on a given query and file context',
        parameters: streamlitAppSchema,
        execute: async (input) => {
            const { query, fileContext } = streamlitAppSchema.parse(input)
            return generateCode(query, fileContext)
        },
    },
]

// Code generation with file context handling
export async function generateCode(
    query: string,
    fileContext?: {
        fileName: string;
        fileType: string;
        analysis?: any;
    }
): Promise<{ generatedCode: string; codeTokenCount: number }> {
    console.log('💻 Starting code generation with:', {
        queryLength: query.length,
        hasFileContext: !!fileContext,
        fileContextDetails: fileContext ? {
            fileName: fileContext.fileName,
            fileType: fileContext.fileType,
            hasAnalysis: !!fileContext.analysis,
            analysisKeys: fileContext.analysis ? Object.keys(fileContext.analysis) : null
        } : null
    })

    if (!query?.trim()) {
        console.error('❌ Empty query provided')
        throw new Error('Query cannot be empty')
    }

    try {
        const systemPrompt = `You are a Python code generation assistant specializing in Streamlit apps.
These are the packages installed where your code will run: [streamlit, pandas, numpy, matplotlib, requests, seaborn, plotly].
${fileContext ? `You are working with a ${fileContext.fileType.toUpperCase()} file named "${fileContext.fileName}".` : ''}
Generate a complete, runnable Streamlit app based on the given query.
DO NOT use "st.experimental_rerun()" at any cost.
Only respond with the code, no potential errors, no explanations!`

        console.log('🤖 Sending request to Anthropic:', {
            model: 'claude-3-5-sonnet-20241022',
            systemPromptLength: systemPrompt.length,
            hasAnalysis: !!fileContext?.analysis,
            fullQuery: query
        })

        const response = await codeGenerationAnthropicAgent.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            temperature: 0.7,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: `${query}${fileContext?.analysis ? `\n\nFile Analysis:\n${JSON.stringify(fileContext.analysis, null, 2)}` : ''}`
                }
            ],
        })

        console.log('✅ Code generation response:', {
            responseType: typeof response.content,
            contentLength: response.content.length,
            tokenUsage: response.usage,
            content: response.content
        })

        if (Array.isArray(response.content) && response.content.length > 0) {
            const generatedCode = response.content[0].type === 'text'
                ? response.content[0].text
                    .replace(/^```python/, '')
                    .replace(/```$/, '')
                    .trim()
                : ''

            console.log('✨ Generated code:', {
                length: generatedCode.length,
                preview: generatedCode.substring(0, 200) + '...'
            })

            return {
                generatedCode,
                codeTokenCount: response.usage.input_tokens + response.usage.output_tokens,
            }
        }

        throw new Error('Unexpected response format from code generation')
    } catch (error) {
        console.error('❌ Code generation failed:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            query: query.substring(0, 100) + '...'
        })
        throw error
    }
}

// Helper functions for tool management
export function getToolByName(name: string): Tool | undefined {
    return tools.find((tool) => tool.toolName === name)
}

export async function executeToolCall(
    toolInvocation: ToolInvocation,
    fileContext?: any
): Promise<any> {
    console.log('🔧 Tool execution started:', {
        toolName: toolInvocation.toolName,
        hasFileContext: !!fileContext
    })

    const tool = getToolByName(toolInvocation.toolName)
    if (!tool) {
        console.error('❌ Tool not found:', toolInvocation.toolName)
        throw new Error(`Tool not found: ${toolInvocation.toolName}`)
    }

    try {
        const args = toolInvocation.toolName === 'create_streamlit_app'
            ? { ...toolInvocation.args, fileContext }
            : toolInvocation.args

        console.log('🔨 Executing tool with args:', {
            toolName: toolInvocation.toolName,
            args
        })

        const result = await tool.execute(args)

        console.log('✅ Tool execution completed:', {
            toolName: toolInvocation.toolName,
            resultType: typeof result,
            resultLength: typeof result === 'string' ? result.length : null
        })

        return result
    } catch (error) {
        console.error('❌ Tool execution failed:', {
            toolName: toolInvocation.toolName,
            error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
    }
}

import { Anthropic } from '@anthropic-ai/sdk'
import { CodeInterpreter } from '@e2b/code-interpreter'
import { Tool } from './types'

const codeGenerationAnthropicAgent = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

export const tools: Tool[] = [
    {
        name: 'create_streamlit_app',
        description: 'Generates Python (Streamlit) code based on a given query',
        input_schema: {
            type: 'object' as const,
            properties: {
                query: {
                    type: 'string',
                    description: 'Detailed requirements for the Streamlit app, including data context and exact column names. Format: ["column1", "column with spaces"]',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'execute_jupyter_notebook',
        description: 'Executes Python code in a single Jupyter Notebook cell with access to the uploaded CSV file',
        input_schema: {
            type: 'object' as const,
            properties: {
                code: {
                    type: 'string',
                    description: 'The Python code to execute in the Jupyter Notebook for a single analysis task',
                },
            },
            required: ['code'],
        },
    },
]

export async function generateCode(
    query: string
): Promise<{ generatedCode: string; codeTokenCount: number }> {
    if (!query || !query.trim()) {
        throw new Error('Query cannot be empty or just whitespace.')
    }

    console.log('Sending query to LLM:', query)

    try {
        const response = await codeGenerationAnthropicAgent.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 2000,
            system: 'You are a Python code generation assistant specializing in Streamlit apps. These are the packages installed where your code will run: [streamlit, pandas, numpy, matplotlib, requests, seaborn, plotly]. Generate a complete, runnable Streamlit app based on the given query. DO NOT use "st.experimental_rerun()" at any cost. Only respond with the code, no potential errors, no explanations!',
            messages: [{ role: 'user', content: query }],
        })

        if (Array.isArray(response.content) && response.content.length > 0) {
            const generatedCode =
                response.content[0].type === 'text'
                    ? response.content[0].text
                          .replace(/^```python/, '')
                          .replace(/```$/, '')
                    : ''
            return {
                generatedCode,
                codeTokenCount:
                    response.usage.input_tokens + response.usage.output_tokens,
            }
        } else {
            console.error('Unexpected response format:', response)
            throw new Error(
                'Unexpected response format from code generation API'
            )
        }
    } catch (error) {
        console.error('Error generating code:', error)
        throw new Error(
            'Failed to generate code. Please check the query and try again.'
        )
    }
}

export async function runNotebook(code: string, fileContent: string, fileName: string) {
    const sandbox = await CodeInterpreter.create({
        apiKey: process.env.E2B_API_KEY,
    });

    try {
        const file = new File([fileContent], fileName, { type: 'text/csv' });
        await sandbox.uploadFile(file, fileName);

        const execution = await sandbox.notebook.execCell(code);
        console.log('Raw execution result:', JSON.stringify(execution, null, 2));

        if (execution.error) {
            return {
                error: {
                    name: execution.error.name,
                    value: execution.error.value,
                    traceback: execution.error.traceback,
                },
            };
        }

        return {
            results: execution.results.map(result => ({
                text: result.text,
                png: result.png,
                html: result.html,
            })),
            logs: {
                stdout: execution.logs.stdout,
                stderr: execution.logs.stderr,
            },
        };
    } catch (error) {
        console.error('Error in runNotebook:', error);
        return {
            error: {
                name: 'ExecutionError',
                value: error instanceof Error ? error.message : String(error),
                traceback: error instanceof Error ? error.stack : '',
            },
        };
    } finally {
        await sandbox.close();
    }
}

export function toolExists(name: string): boolean {
    return tools.some((tool) => tool.name === name)
}

export function getToolByName(name: string): Tool | undefined {
    return tools.find((tool) => tool.name === name)
}
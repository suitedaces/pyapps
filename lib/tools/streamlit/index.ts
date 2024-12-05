import { anthropic } from '@ai-sdk/anthropic'
import { StreamlitToolArgs, Tool } from '../types'
import { streamObject, ToolExecutionOptions } from 'ai'
import { streamlitAppSchema } from './types'
import { z } from 'zod'

// Define the response schema
const pythonCodeSchema = z.object({
  code: z.string().describe('The Python code for the Streamlit application')
})

type PythonCodeResponse = z.infer<typeof pythonCodeSchema>

const extractRequiredLibraries = (code: string): string[] => {
  const importRegex = /^(?:import|from)\s+([a-zA-Z0-9_]+)/gm
  const libraries = new Set<string>()

  let match
  while ((match = importRegex.exec(code)) !== null) {
    libraries.add(match[1])
  }

  return Array.from(libraries)
}

const getFilePath = (fileName: string) => {
  // Remove any leading slashes and ensure correct path
  const cleanFileName = fileName.replace(/^\/+/, '')
  return `/app/s3/data/${cleanFileName}`
}

export const streamlitTool: Tool = {
  toolName: 'create_streamlit_app',
  description: 'Generates Python (Streamlit) code based on a given query and file context',
  schema: streamlitAppSchema,

  execute: async (args: StreamlitToolArgs, options?: ToolExecutionOptions) => {
    try {
      const filePath = args.fileContext ? getFilePath(args.fileContext.fileName) : undefined

      const systemPrompt = `You are a Python code generation assistant specializing in Streamlit apps.
Generate a complete, runnable Streamlit app based on the given query.
${args.fileContext ? `You are working with a ${args.fileContext.fileType.toUpperCase()} file at path "${filePath}".` : ''}
IMPORTANT: Always use the FULL PATH when reading files.
DO NOT use "st.experimental_rerun()" at any cost.
Only respond with the code, no potential errors, no explanations!
Include all necessary imports at the beginning of the file.`

      const userQuery = `${args.query}${
        args.fileContext ? `\nIMPORTANT: Use the exact file path "${filePath}" to read the file.` : ''
      }${args.fileContext?.analysis ? `\n\nFile Analysis:\n${JSON.stringify(args.fileContext.analysis, null, 2)}` : ''}`

      console.log(" Starting streamObject request with:", { userQuery })

      let finalPythonCode = ''

      const { partialObjectStream } = streamObject({
        model: anthropic('claude-3-5-sonnet-20241022'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery }
        ],
        schema: pythonCodeSchema,
        output: 'object'
      })

      // Stream and collect the Python code
      for await (const partialObject of partialObjectStream) {
        const { code } = partialObject
        if (!code) continue;
        console.log("🔧 Received partial Python code chunk, length:", code)
        finalPythonCode = code
      }

      console.log("✅ Final Python code assembled, length:", finalPythonCode.length)

      // Extract required libraries and return the complete result
      const requiredLibraries = extractRequiredLibraries(finalPythonCode)
      console.log("📚 Extracted required libraries:", requiredLibraries)

      return {
        content: finalPythonCode,
        metadata: {
          requiredLibraries
        }
      }
    } catch (error) {
      console.error("❌ Error in streamlit tool execution:", error)
      throw new Error(error instanceof Error ? error.message : 'Unknown error in streamlit tool execution')
    }
  }
}

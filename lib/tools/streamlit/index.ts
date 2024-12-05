import { anthropic } from '@ai-sdk/anthropic'
import { StreamlitToolArgs, Tool } from '../types'
import { streamObject, ToolExecutionOptions, createDataStream } from 'ai'
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

// Add timeout utility
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]) as Promise<T>
}

export const streamlitTool: Tool = {
  toolName: 'create_streamlit_app',
  description: 'Generates Python (Streamlit) code based on a given query and file context',
  schema: streamlitAppSchema,

  execute: async (args: StreamlitToolArgs, options?: ToolExecutionOptions) => {
    const TIMEOUT_MS = 30000 // 30 second timeout
    let streamCleanup: (() => void) | undefined

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

      console.log("🚀 Starting streamlit code generation:", { query: args.query })

      let finalPythonCode = ''
      let lastChunkTime = Date.now()

      const result = streamObject({
        model: anthropic('claude-3-5-sonnet-20241022'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery }
        ],
        schema: pythonCodeSchema,
        output: 'object',
        onCompletion: () => {
          console.log("✨ Stream completed successfully")
        }
      })

      streamCleanup = result.cleanup

      // Process stream with timeout
      await withTimeout(
        (async () => {
          for await (const partialObject of result.partialObjectStream) {
            lastChunkTime = Date.now()

            if (!partialObject?.code) {
              console.log("⚠️ Received empty chunk, skipping")
              continue
            }

            console.log("📝 Processing chunk, length:", partialObject.code.length)
            finalPythonCode = partialObject.code
          }
        })(),
        TIMEOUT_MS
      )

      if (!finalPythonCode) {
        throw new Error("No valid Python code was generated")
      }

      const requiredLibraries = extractRequiredLibraries(finalPythonCode)
      console.log("📚 Required libraries:", requiredLibraries)

      return {
        content: finalPythonCode,
        metadata: {
          requiredLibraries,
          generationTime: Date.now() - lastChunkTime
        }
      }

    } catch (error) {
      console.error("❌ Streamlit tool error:", error)

      // Ensure proper error type is thrown
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Unknown error in streamlit tool execution')

    } finally {
      // Cleanup stream resources
      if (streamCleanup) {
        try {
          streamCleanup()
        } catch (cleanupError) {
          console.error("⚠️ Stream cleanup error:", cleanupError)
        }
      }
    }
  }
}

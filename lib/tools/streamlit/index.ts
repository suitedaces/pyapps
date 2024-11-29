import { anthropic } from '@ai-sdk/anthropic'
import { BaseStreamingTool } from '../base'
import { ToolStreamResponse } from '../types'
import { streamlitAppSchema, StreamlitToolArgs, StreamlitToolResult } from './types'
import { generateText, streamText } from 'ai'

export class StreamlitTool extends BaseStreamingTool {
    toolName = 'create_streamlit_app'
    description = 'Generates Python (Streamlit) code based on a given query and file context'
    parameters = streamlitAppSchema

    async *streamExecution(
        args: StreamlitToolArgs,
        signal?: AbortSignal
    ): AsyncGenerator<ToolStreamResponse> {
        const toolCallId = crypto.randomUUID()

        try {
            await this.validateArgs(args)

            this.updateState(toolCallId, {
                status: 'starting',
                args,
            })

            const systemPrompt = this.createSystemPrompt(args.fileContext)
            const userQuery = this.formatQuery(args.query, args.fileContext)

            const { textStream } = await streamText({
                model: anthropic('claude-3-5-sonnet-20240620'),
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userQuery }
                ],
                maxTokens: 2000,
                temperature: 0.7,
            })

            let collectedCode = ''
            let progress = 0
            let chunkCount = 0

            for await (const chunk of textStream) {
                if (signal?.aborted) break

                const cleanedText = chunk
                    .replace(/^```python\n?/, '')
                    .replace(/^python\n/, '')
                    .replace(/\n```$/, '')
                    .replace(/```$/, '')

                collectedCode += cleanedText
                chunkCount++

                if (cleanedText.trim()) {
                    yield this.createToolCallDelta(toolCallId, cleanedText)
                }

                progress = Math.min(95, Math.floor((chunkCount / 100) * 100))
                if (progress % 10 === 0) {
                    yield this.reportProgress(toolCallId, progress)
                }
            }

            const requiredLibraries = this.extractRequiredLibraries(collectedCode)

            const result: StreamlitToolResult = {
                code: collectedCode,
                requiredLibraries: requiredLibraries
            }

            console.log('📦 Final StreamlitTool result:', {
                codeLength: result.code.length,
                codePreview: result.code.substring(0, 100) + '...',
                requiredLibraries: result.requiredLibraries,
                librariesCount: result.requiredLibraries.length,
            })

            console.log('🔍 Full result details:', JSON.stringify(result, null, 2))

            yield this.createToolResult(toolCallId, result)
        } catch (error) {
            console.error('StreamlitTool execution error:', error)
            throw error
        } finally {
            this.cleanup(toolCallId)
        }
    }

    private extractRequiredLibraries(code: string): string[] {
        const importRegex = /^(?:import|from)\s+([a-zA-Z0-9_]+)/gm
        const libraries = new Set<string>()

        let match
        while ((match = importRegex.exec(code)) !== null) {
            libraries.add(match[1])
        }

        return Array.from(libraries)
    }

    private createSystemPrompt(
        fileContext?: StreamlitToolArgs['fileContext']
    ): string {
        return `You are a Python code generation assistant specializing in Streamlit apps.
Generate a complete, runnable Streamlit app based on the given query.
${fileContext ? `You are working with a ${fileContext.fileType.toUpperCase()} file named "${fileContext.fileName}" at path "/app/${fileContext.fileName}".` : ''}
IMPORTANT: Always use the FULL PATH "/app/${fileContext?.fileName}" when reading the CSV file.
DO NOT use relative paths, always use the absolute path starting with "/app/".
DO NOT use "st.experimental_rerun()" at any cost.
Only respond with the code, no potential errors, no explanations!
Include all necessary imports at the beginning of the file.`
    }

    private formatQuery(
        query: string,
        fileContext?: StreamlitToolArgs['fileContext']
    ): string {
        const filePathNote = fileContext
            ? `\nIMPORTANT: Use the exact file path "/app/${fileContext.fileName}" to read the CSV file.`
            : ''

        return `${query}${filePathNote}${
            fileContext?.analysis
                ? `\n\nFile Analysis:\n${JSON.stringify(fileContext.analysis, null, 2)}`
                : ''
        }`
    }
}

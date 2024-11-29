import { Anthropic } from '@anthropic-ai/sdk'
import { BaseStreamingTool } from '../base'
import { ToolStreamResponse } from '../types'
import { streamlitAppSchema, StreamlitToolArgs, StreamlitToolResult } from './types'

export class StreamlitTool extends BaseStreamingTool {
    toolName = 'create_streamlit_app'
    description = 'Generates Python (Streamlit) code based on a given query and file context'
    parameters = streamlitAppSchema

    private anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    })

    async *streamExecution(
        args: StreamlitToolArgs,
        signal?: AbortSignal
    ): AsyncGenerator<ToolStreamResponse> {
        const toolCallId = crypto.randomUUID()

        console.log('🚀 StreamlitTool execution started:', {
            toolCallId,
            hasFileContext: !!args.fileContext,
            query: args.query.substring(0, 100) + '...',
        })

        try {
            await this.validateArgs(args)
            console.log('✅ Arguments validated successfully')

            this.updateState(toolCallId, {
                status: 'starting',
                args,
            })

            // Start with streaming start
            yield this.createToolCallStart(toolCallId)

            const systemPrompt = this.createSystemPrompt(args.fileContext)
            const userQuery = this.formatQuery(args.query, args.fileContext)

            console.log('📤 Sending request to Anthropic:', {
                model: 'claude-3-5-sonnet-20241022',
                systemPromptLength: systemPrompt.length,
                userQueryLength: userQuery.length,
                hasFileContext: !!args.fileContext,
            })

            const stream = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2000,
                temperature: 0.7,
                system: systemPrompt,
                messages: [{ role: 'user', content: userQuery }],
                stream: true,
            })

            let collectedCode = ''
            let progress = 0
            let chunkCount = 0

            // Process the stream
            for await (const chunk of stream) {
                if (signal?.aborted) {
                    console.log('⚠️ Stream aborted by signal')
                    break
                }

                if (chunk.type === 'content_block_delta' && chunk.delta) {
                    const delta = chunk.delta as { type: string; text?: string }
                    const text = delta.text || ''

                    // Enhanced cleaning logic to remove markdown and language identifier
                    const cleanedText = text
                        .replace(/^```python\n?/, '') // Remove opening ```python
                        .replace(/^python\n/, '')     // Remove standalone "python" line
                        .replace(/\n```$/, '')        // Remove closing ```
                        .replace(/```$/, '')          // Remove closing ``` without newline

                    collectedCode += cleanedText
                    chunkCount++

                    console.log('📦 Processing chunk:', {
                        chunkNumber: chunkCount,
                        chunkLength: cleanedText.length,
                        totalCollected: collectedCode.length,
                    })

                    // Only yield if there's actual content after cleaning
                    if (cleanedText.trim()) {
                        yield this.createToolCallDelta(toolCallId, cleanedText)
                    }

                    progress = Math.min(95, Math.floor((chunkCount / 100) * 100))
                    console.log('🔄 Progress:', { progress, chunkCount })
                }
            }

            // Extract required libraries from the code
            const requiredLibraries = this.extractRequiredLibraries(collectedCode)

            // Create final result object
            const result: StreamlitToolResult = {
                code: collectedCode,
                requiredLibraries: requiredLibraries.map(lib => ({
                    name: lib,
                    version: undefined,
                    installed: false
                }))
            }

            console.log('✅ Stream processing completed:', {
                totalChunks: chunkCount,
                totalLength: collectedCode.length,
                requiredLibraries,
                preview: collectedCode.substring(0, 100) + '...',
            })

            // Send final result
            yield this.createToolResult(toolCallId, result)
        } catch (error) {
            console.error('StreamlitTool execution error:', error)
            throw error
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

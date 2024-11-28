import { Anthropic } from '@anthropic-ai/sdk'
import { BaseStreamingTool } from '../base'
import { ToolStreamResponse } from '../types'
import { streamlitAppSchema, StreamlitToolArgs } from './types'

export class StreamlitTool extends BaseStreamingTool {
    toolName = 'create_streamlit_app'
    description =
        'Generates Python (Streamlit) code based on a given query and file context'
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

                    // Remove markdown backticks if present in the chunk
                    const cleanedText = text
                        .replace(/^```python\n/, '')
                        .replace(/\n```$/, '')
                        .replace(/```$/, '')

                    collectedCode += cleanedText
                    chunkCount++

                    console.log('📦 Processing chunk:', {
                        chunkNumber: chunkCount,
                        chunkLength: cleanedText.length,
                        totalCollected: collectedCode.length,
                    })

                    yield this.createToolCallDelta(toolCallId, cleanedText)

                    progress = Math.min(
                        95,
                        Math.floor((chunkCount / 100) * 100)
                    )
                    console.log('🔄 Progress:', { progress, chunkCount })
                }
            }

            console.log('✅ Stream processing completed:', {
                totalChunks: chunkCount,
                totalLength: collectedCode.length,
                preview: collectedCode.substring(0, 100) + '...',
            })

            // Send final result
            yield this.createToolResult(toolCallId, collectedCode)
        } catch (error) {
            console.error('StreamlitTool execution error:', error)
            throw error
        }
    }

    private createSystemPrompt(
        fileContext?: StreamlitToolArgs['fileContext']
    ): string {
        return `You are a Python code generation assistant specializing in Streamlit apps.
These are the packages installed where your code will run: [streamlit, pandas, numpy, matplotlib, requests, seaborn, plotly].
${fileContext ? `You are working with a ${fileContext.fileType.toUpperCase()} file named "${fileContext.fileName}" at path "/app/${fileContext.fileName}".` : ''}
Generate a complete, runnable Streamlit app based on the given query.
IMPORTANT: Always use the FULL PATH "/app/${fileContext?.fileName}" when reading the CSV file.
DO NOT use relative paths, always use the absolute path starting with "/app/".
DO NOT use "st.experimental_rerun()" at any cost.
Only respond with the code, no potential errors, no explanations!`
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

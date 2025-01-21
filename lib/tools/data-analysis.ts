import Sandbox from '@e2b/code-interpreter'
import { tool } from 'ai'
import { z } from 'zod'
import { setupS3Mount } from '../s3'
import { getUser } from '../supabase/server'

const dataAnalysisToolSchema = z.object({
    code: z
        .string()
        .describe('Complete, runnable Python code for data analysis including all necessary imports'),
})

type DataAnalysisToolOutput = {
    results: Array<{
        type: 'stdout' | 'stderr' | 'image' | 'error'
        content: string
        mimeType?: string
    }>
    error?: {
        name: string
        value: string
        traceback: string
    }
}

export const dataAnalysisTool = tool<typeof dataAnalysisToolSchema, DataAnalysisToolOutput>({
    parameters: dataAnalysisToolSchema,
    execute: async (args: { code: string }, options: any) => {
        try {
            const user = await getUser()
            if (!user) {
                throw new Error('User not authenticated')
            }
            
            const sandbox = await Sandbox.create()
            
            // Execute the code in the sandbox
            const execution = await sandbox.runCode(args.code)

            // await setupS3Mount(sandbox, user.id)
            
            const results: DataAnalysisToolOutput['results'] = []
            
            // Handle execution error
            if (execution.error) {
                return {
                    results: [{
                        type: 'error',
                        content: execution.error.traceback
                    }],
                    error: execution.error
                }
            }

            // Process results
            for (const result of execution.results) {
                // Handle text output
                if (result.text) {
                    results.push({
                        type: 'stdout',
                        content: result.text
                    })
                }
                // Handle stderr from logs
                if (execution.logs.stderr.length > 0) {
                    results.push({
                        type: 'stderr',
                        content: execution.logs.stderr.join('\n')
                    })
                }
                // Handle PNG images
                if (result.png) {
                    results.push({
                        type: 'image',
                        content: result.png,
                        mimeType: 'image/png'
                    })
                }
            }

            await sandbox.kill()
            const executionTime = Date.now() - startTime
            console.log('[DataAnalysis] Execution completed successfully', {
                executionTimeMs: executionTime,
                resultCount: results.length
            })
            
            return { results }
        } catch (error) {
            const executionTime = Date.now() - startTime
            console.error('[DataAnalysis] Fatal error during execution', {
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTimeMs: executionTime,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw error
        }
    },
}) 
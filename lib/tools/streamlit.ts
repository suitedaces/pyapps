import { Sandbox } from '@e2b/code-interpreter'
import { tool } from 'ai'
import { z } from 'zod'
import { setupS3Mount } from '@/lib/s3'
import { getUser } from '@/lib/supabase/server'

const streamlitToolSchema = z.object({
    code: z
        .string()
        .describe(
            'Complete, runnable Streamlit app code including all necessary imports. If the user has data, code should use the path "/app/s3/data/<filenamewithextension>" to read the data.'
        ),
    requiredLibraries: z
        .array(z.string())
        .describe(
            'List of Python package dependencies required to run the Streamlit app'
        ),
    appName: z
        .string()
        .describe('Descriptive name for the Streamlit application'),
    appDescription: z
        .string()
        .max(200, 'Keep description concise')
        .describe("Brief summary of the app's functionality and purpose"),
})

type StreamlitToolInput = z.infer<typeof streamlitToolSchema>
type StreamlitToolOutput = { errors: string }

export const streamlitTool = tool<typeof streamlitToolSchema, StreamlitToolOutput>({
    parameters: streamlitToolSchema,
    execute: async ({
        code,
        requiredLibraries,
        appName,
        appDescription,
    }: StreamlitToolInput) => {
        let sandbox = null
        let errorLogs = ''

        try {
            const user = await getUser()
            if (!user) {
                return { errors: 'User not authenticated' }
            }

            sandbox = await Sandbox.create('streamlit-sandbox-s3', {
                metadata: {
                    userId: user.id,
                    appName,
                    appDescription,
                    createdAt: new Date().toISOString(),
                }
            })
            
            await setupS3Mount(sandbox, user.id)
            await sandbox.files.makeDir('/app')
            await sandbox.files.write('/app/test.py', code)

            try {
                await sandbox.commands.run('python /app/test.py', {
                    onStderr: (data) => {
                        errorLogs += data
                        console.error('Script error:', data)
                    },
                    onStdout: (data) => {
                        console.log('Script output:', data)
                    }
                })
            } catch (cmdError) {
                console.error('Command failed')
            }

            // Clean and process the error logs
            const cleanedLogs = errorLogs.trim()
            
            // If logs are empty, return no errors
            if (!cleanedLogs) {
                return { errors: 'No errors found!' }
            }

            // Look for Python traceback - the most reliable error indicator
            const tracebackIndex = cleanedLogs.lastIndexOf('Traceback')
            console.log('TRACEBACK FOUND: ', cleanedLogs.substring(tracebackIndex))
            if (tracebackIndex !== -1) {
                return { errors: cleanedLogs.substring(tracebackIndex) }
            }

            // No traceback found, assume no significant errors
            return { errors: 'No errors found!' }
        } catch (error) {
            console.error('Sandbox error:', error)
            return { errors: errorLogs || 'Sandbox error occurred' }
        } finally {
            if (sandbox) {
                try {
                    await sandbox.kill()
                } catch (error) {
                    console.error('Cleanup error:', error)
                }
            }
        }
    },
})
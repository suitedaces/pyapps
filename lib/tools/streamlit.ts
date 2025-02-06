import { Sandbox } from 'e2b'
import { tool } from 'ai'
import { z } from 'zod'
import { setupS3Mount } from '@/lib/s3'
import { getUser } from '@/lib/supabase/server'

const streamlitToolSchema = z.object({
    code: z
        .string()
        .describe(
            'Complete, runnable Streamlit app code including all necessary imports. If the user has data, code should use the path "/app/s3/data/<filenamewithextension>" to read the data. DO NOT write any placeholders for code. You are to write the complete file.'
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

            sandbox = await Sandbox.create({
                template: 'streamlit-sandbox-s3',
                metadata: {
                    userId: user.id,
                    appName,
                    appDescription,
                    createdAt: new Date().toISOString(),
                }
            })

            await setupS3Mount(sandbox, user.id)
            await sandbox.filesystem.makeDir('/app')
            await sandbox.filesystem.write('/app/test.py', code)

            console.log('STATRING TOOL CALL')
            try {
                await sandbox.process.startAndWait({
                    cmd: 'export STREAMLIT_RUN_BARE=true && python /app/test.py',
                    onStderr: (data: string) => {
                        errorLogs += data
                        console.error('Script error:', data)
                    },
                    onStdout: (data: string) => {
                        console.log('Script output:', data)
                    }
                } as any)
            } catch (error) {
                console.error('Command failed')
            }

            // Clean and process the error logs
            const cleanedLogs = errorLogs.trim()
            
            // If logs are empty, return no errors
            if (!cleanedLogs) {
                return { errors: 'No errors found!' }
            }

            console.log('CLEANED LOGS: ', cleanedLogs)

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
                    await sandbox.close()
                } catch (error) {
                    console.error('Cleanup error:', error)
                }
            }
        }
    },
})
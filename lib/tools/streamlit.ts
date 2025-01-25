import { Sandbox } from 'e2b'
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
        try {
            const user = await getUser()
            if (!user) {
                throw new Error('User not authenticated')
            }

            const sandbox = await Sandbox.create({
                template: 'streamlit-sandbox-s3'
            })
            
            await setupS3Mount(sandbox, user.id)
            
            await sandbox.filesystem.makeDir('/app')
            await sandbox.filesystem.write('/app/test.py', code)

            const execution = await sandbox.process.startAndWait({
                cmd: 'python /app/test.py',
                timeout: 10000,
            })

            // Get all output
            const fullOutput = execution.stdout + execution.stderr
            
            // Extract only traceback and subsequent content
            const tracebackMatch = fullOutput.match(/Traceback \(most recent call last\):[\s\S]*$/m)
            const errors = tracebackMatch ? tracebackMatch[0] : 'No errors found!'

            await sandbox.close()

            return { errors }
        } catch (error) {
            console.error('Sandbox execution error:', error)
            throw error
        }
    },
})
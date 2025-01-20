import { ProcessMessage, Sandbox } from 'e2b'
import { CoreTool, tool } from 'ai'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

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
            // Create E2B sandbox instance
            const sandbox = await Sandbox.create()

            // Read the check.py script
            const checkScript = fs.readFileSync(
                path.join(process.cwd(), 'lib/tools/check.py'),
                'utf-8'
            )

            // Save both files to sandbox
            await sandbox.filesystem.makeDir('/test')
            await sandbox.filesystem.write('/test/check.py', checkScript)
            await sandbox.filesystem.write('/test/app.py', code)

            // Execute check.py to validate app.py
            const execution = await sandbox.process.startAndWait({
                cmd: 'python /test/check.py',
            })
            const errors = execution.stdout + execution.stderr
            console.log('Errors!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!:', errors)
            console.log('Generated Streamlit code:', {
                codeLength: code.length,
                firstLines: code.split('\n').slice(0, 3).join('\n'),
                appName,
                appDescription,
                errors: errors || 'No errors found'
            })

            // Close sandbox after execution
            await sandbox.close()

            console.log('Errors in sandbox:', errors)
            return {
                errors: errors || 'No errors found!'
            }
        } catch (error) {
            console.error('Sandbox execution error:', error)
            throw error
        }
    },
})
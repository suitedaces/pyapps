import { CodeInterpreter } from '@e2b/code-interpreter'

export async function createCodeInterpreter() {
    try {
        const codeInterpreter = await CodeInterpreter.create({
            apiKey: process.env.E2B_API_KEY,
            template: 'jupyter-notebook',
        })

        return codeInterpreter
    } catch (error) {
        console.error('Error creating CodeInterpreter:', error)
        throw error
    }
}

export async function runNotebook(code: string) {
    const codeInterpreter = await createCodeInterpreter()

    const { results } = await codeInterpreter.notebook.execCell(code)

    await codeInterpreter.close()

    return results
}

import { streamlitTool } from './streamlit'
import { Tool } from './types'

const availableTools: Record<string, Tool> = {
    streamlit: streamlitTool,
} as const

export type ToolName = keyof typeof availableTools

export const getTools = (options?: { include?: ToolName[] }): Tool[] => {
    if (!options?.include) {
        return Object.values(availableTools)
    }

    return options.include
        .map(name => availableTools[name])
        .filter((tool): tool is Tool => tool !== undefined)
}

export const getTool = (name: ToolName): Tool | undefined => availableTools[name]

// Validate tool arguments
export const validateToolArgs = async (name: ToolName, args: unknown) => {
    const tool = getTool(name)
    if (!tool) {
        return { valid: false, error: `Tool "${name}" not found` }
    }

    try {
        await tool.schema.parseAsync(args)
        return { valid: true, args }
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Invalid arguments'
        }
    }
}

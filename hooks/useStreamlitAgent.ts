import { streamlitAgent } from '@/app/actions/agent'
import { useState, useCallback } from 'react'

export function useStreamlitAgent() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const generateCode = useCallback(async (
        input: string,
        chatId: string,
        userId: string,
        fileContext?: {
            fileName?: string
            fileType?: string
            content?: string
        }
    ) => {
        setIsGenerating(true)
        setError(null)

        try {
            const stream = await streamlitAgent(
                input,
                chatId,
                userId,
                fileContext
            )

            return stream
        } catch (e) {
            setError(e instanceof Error ? e : new Error('Failed to generate code'))
            throw e
        } finally {
            setIsGenerating(false)
        }
    }, [])

    return {
        generateCode,
        isGenerating,
        error
    }
} 
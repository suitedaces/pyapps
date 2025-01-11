import { create } from 'zustand'

interface SandboxState {
    // Execution state
    sandboxId: string | null
    isInitializing: boolean
    lastExecutedCode: string | null
    error: string | null

    // UI state
    streamlitUrl: string | null
    isLoadingSandbox: boolean
    isGeneratingCode: boolean
    generatedCode: string

    // Methods
    updateSandbox: (
        code: string,
        forceExecute?: boolean,
        appId?: string
    ) => Promise<string | null>
    killSandbox: () => Promise<void>
    clearError: () => void
    setGeneratingCode: (isGenerating: boolean) => void
    setStreamlitUrl: (url: string | null) => void
    setIsLoadingSandbox: (loading: boolean) => void
    setGeneratedCode: (code: string) => void
}

// Add helper functions at the top
const getSessionId = () => {
    if (typeof window === 'undefined') return null
    let sessionId = sessionStorage.getItem('sandbox_session_id')
    if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2, 15)
        sessionStorage.setItem('sandbox_session_id', sessionId)
    }
    return sessionId
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
    // Execution state
    sandboxId: null,
    isInitializing: false,
    lastExecutedCode: null,
    error: null,

    // UI state
    streamlitUrl: null,
    isLoadingSandbox: false,
    isGeneratingCode: false,
    generatedCode: '',

    // Methods
    setGeneratingCode: (isGenerating) =>
        set({ isGeneratingCode: isGenerating }),

    updateSandbox: async (code: string, forceExecute: boolean = false, appId?: string) => {
        const { sandboxId, lastExecutedCode } = get()
        const sessionId = getSessionId()

        if (!forceExecute && code === lastExecutedCode) {
            set({ isLoadingSandbox: false, isGeneratingCode: false })
            return get().streamlitUrl
        }

        try {
            set({
                isInitializing: true,
                error: null,
                isLoadingSandbox: true,
            })

            const response = await fetch(
                `/api/sandbox/${sandboxId || 'new'}/execute`,
                {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Session-Id': sessionId || '',
                        ...(appId && { 'X-App-Id': appId })
                    },
                    body: JSON.stringify({ code })
                }
            )

            if (!response.ok) {
                throw new Error('Failed to execute code')
            }

            const data = await response.json()
            set({
                lastExecutedCode: code,
                sandboxId: data.sandboxId,
                streamlitUrl: data.url,
                isInitializing: false,
                isGeneratingCode: false,
                error: null
            })
            return data.url
        } catch (error) {
            set({
                error: 'Failed to update sandbox',
                isInitializing: false,
                isLoadingSandbox: false,
                isGeneratingCode: false
            })
            return null
        }
    },

    killSandbox: async () => {
        const { sandboxId } = get()
        const sessionId = getSessionId()

        if (sandboxId) {
            try {
                set({ error: null })
                await fetch(`/api/sandbox/${sandboxId}/kill`, {
                    method: 'POST',
                    headers: {
                        'X-Session-Id': sessionId || '',
                    },
                })
                set({
                    sandboxId: null,
                    streamlitUrl: null,
                    lastExecutedCode: null,
                    isLoadingSandbox: false,
                    isGeneratingCode: false,
                })
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : 'Failed to kill sandbox'
                set({ error: errorMessage })
                console.error('Error killing sandbox:', error)
            }
        }
    },

    clearError: () => set({ error: null }),

    setStreamlitUrl: (url) => set({ streamlitUrl: url }),
    setIsLoadingSandbox: (loading) => set({ isLoadingSandbox: loading }),
    setGeneratedCode: (code) => set({ generatedCode: code }),
}))

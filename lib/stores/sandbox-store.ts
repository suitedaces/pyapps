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
        forceExecute?: boolean
    ) => Promise<string | null>
    killSandbox: () => Promise<void>
    clearError: () => void
    setGeneratingCode: (isGenerating: boolean) => void
    setStreamlitUrl: (url: string | null) => void
    setIsLoadingSandbox: (loading: boolean) => void
    setGeneratedCode: (code: string) => void
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

    updateSandbox: async (code: string, forceExecute: boolean = false) => {
        const { sandboxId, lastExecutedCode } = get()

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
                    headers: { 'Content-Type': 'application/json' },
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

        if (sandboxId) {
            try {
                set({ error: null })
                await fetch(`/api/sandbox/${sandboxId}/kill`, {
                    method: 'POST',
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

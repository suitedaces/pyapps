import { create } from 'zustand'

interface SandboxState {
    sandboxId: string | null
    isInitializing: boolean
    lastExecutedCode: string | null
    error: string | null
    updateSandbox: (code: string, forceExecute?: boolean) => Promise<string | null>
    killSandbox: () => Promise<void>
    clearError: () => void
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
    sandboxId: null,
    isInitializing: false,
    lastExecutedCode: null,
    error: null,

    updateSandbox: async (code: string, forceExecute: boolean = false) => {
        const { sandboxId, lastExecutedCode } = get()

        if (!forceExecute && code === lastExecutedCode) {
            return null
        }

        try {
            set({ isInitializing: true, error: null })
            const response = await fetch(`/api/sandbox/${sandboxId || 'new'}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.details || 'Failed to execute code')
            }

            const data = await response.json()
            set({ 
                lastExecutedCode: code,
                sandboxId: data.sandboxId,
                isInitializing: false 
            })
            return data.url
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update sandbox'
            set({ 
                error: errorMessage,
                isInitializing: false 
            })
            console.error('Error updating sandbox:', error)
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sandboxId }),
                })
                set({ sandboxId: null })
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to kill sandbox'
                set({ error: errorMessage })
                console.error('Error killing sandbox:', error)
            }
        }
    },

    clearError: () => set({ error: null })
}))

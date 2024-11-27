import { create } from 'zustand'

interface SandboxState {
    sandboxId: string | null
    isInitializing: boolean
    lastExecutedCode: string | null
    initializeSandbox: () => Promise<void>
    killSandbox: () => Promise<void>
    updateSandbox: (
        code: string,
        forceExecute: boolean
    ) => Promise<string | null>
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
    sandboxId: null,
    isInitializing: false,
    lastExecutedCode: null,

    initializeSandbox: async () => {
        const state = get()
        if (state.isInitializing || state.sandboxId) return

        set({ isInitializing: true })

        try {
            const response = await fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!response.ok) {
                throw new Error('Failed to initialize sandbox')
            }

            const data = await response.json()
            set({
                sandboxId: data.sandboxId,
                isInitializing: false,
            })
        } catch (error) {
            console.error('Sandbox initialization error:', error)
            set({ isInitializing: false })
        }
    },

    killSandbox: async () => {
        const { sandboxId } = get()
        if (sandboxId) {
            try {
                await fetch(`/api/sandbox/${sandboxId}/kill`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sandboxId }),
                })
                set({ sandboxId: null })
            } catch (error) {
                console.error('Error killing sandbox:', error)
            }
        }
    },

    updateSandbox: async (code: string, forceExecute: boolean = false) => {
        const { sandboxId, lastExecutedCode } = get()

        if (!sandboxId) {
            return null
        }

        if (!forceExecute && code === lastExecutedCode) {
            return null
        }

        try {
            const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })

            if (!response.ok) {
                throw new Error(`Failed to execute code: ${response.status}`)
            }

            const data = await response.json()
            set({ lastExecutedCode: code })
            return data.url
        } catch (error) {
            console.error('Error updating sandbox:', error)
            return null
        }
    },
}))

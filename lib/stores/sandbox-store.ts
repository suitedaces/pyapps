import { create } from 'zustand'
import { Sandbox } from 'e2b'

interface SandboxState {
  sandbox: Sandbox | null
  sandboxId: string | null
  isInitializing: boolean
  lastExecutedCode: string | null
  initializeSandbox: () => Promise<void>
  killSandbox: () => Promise<void>
  updateSandbox: (code: string, forceExecute?: boolean) => Promise<string | null>
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
  sandbox: null,
  sandboxId: null,
  isInitializing: false,
  lastExecutedCode: null,

  initializeSandbox: async () => {
    const state = get()
    if (state.isInitializing || state.sandbox) return

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
      const sandbox = await Sandbox.reconnect(data.sandboxId)

      set({
        sandbox,
        sandboxId: data.sandboxId,
        isInitializing: false
      })
    } catch (error) {
      console.error('Sandbox initialization error:', error)
      set({ isInitializing: false })
    }
  },

  killSandbox: async () => {
    const { sandbox } = get()
    if (sandbox) {
      try {
        await sandbox.close()
        set({ sandbox: null, sandboxId: null })
      } catch (error) {
        console.error('Error killing sandbox:', error)
      }
    }
  },

  updateSandbox: async (code: string, forceExecute = false) => {
    const { sandbox, sandboxId, lastExecutedCode } = get()
    if (!sandbox || !sandboxId) return null

    if (!forceExecute && code === lastExecutedCode) {
      const url = sandbox.getHostname(8501)
      return `https://${url}`
    }

    try {
      await sandbox.filesystem.write('/app/app.py', code)
      const process = await sandbox.process.start({
        cmd: 'streamlit run /app/app.py',
        onStdout: (data) => console.log('Streamlit stdout:', data),
        onStderr: (data) => console.error('Streamlit stderr:', data),
      })

      const url = sandbox.getHostname(8501)
      set({ lastExecutedCode: code })
      return `https://${url}`
    } catch (error) {
      console.error('Error updating sandbox:', error)
      return null
    }
  }
}))

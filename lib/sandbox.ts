import { Sandbox as E2BSandbox } from '@e2b/code-interpreter'

declare const process: {
    env: {
        E2B_API_KEY: string;
        [key: string]: string | undefined;
    }
}

// Track one sandbox per user
const userSandboxes = new Map<string, { id: string, instance: E2BSandbox }>()

export class Sandbox {
    static async create(userId: string): Promise<E2BSandbox> {
        if (!userId) throw new Error('userId is required')

        // Kill existing sandbox if any
        await this.killUserSandbox(userId)

        const sandbox = await E2BSandbox.create('streamlit-sandbox-me2', {
            apiKey: process.env.E2B_API_KEY || '',
            timeoutMs: 5 * 60 * 1000,
            metadata: { userId }
        })

        userSandboxes.set(userId, { id: sandbox.sandboxId, instance: sandbox })
        
        // Store sandbox ID in localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem(`sandbox-${userId}`, sandbox.sandboxId)
        }

        return sandbox
    }

    static async connect(sandboxId: string): Promise<E2BSandbox> {
        const sandbox = await E2BSandbox.connect(sandboxId)
        return sandbox
    }

    static async killUserSandbox(userId: string): Promise<void> {
        const existing = userSandboxes.get(userId)
        if (existing) {
            try {
                await existing.instance.kill()
            } catch (error) {
                console.error('Error killing sandbox:', error)
            }
            userSandboxes.delete(userId)
            
            // Remove from localStorage
            if (typeof window !== 'undefined') {
                localStorage.removeItem(`sandbox-${userId}`)
            }
        }
    }

    static getUserSandbox(userId: string) {
        // Try memory first
        const memoryInstance = userSandboxes.get(userId)
        if (memoryInstance) return memoryInstance

        // Try localStorage
        if (typeof window !== 'undefined') {
            const storedId = localStorage.getItem(`sandbox-${userId}`)
            if (storedId) {
                return { id: storedId, instance: null }
            }
        }

        return null
    }
} 
'use client'

import { createContext, useContext, useCallback, useState, useEffect } from 'react'
import { Sandbox, SandboxMetadata, RunningSandbox } from '@/lib/sandbox'
import { useAuth } from './AuthContext'

interface SandboxState {
    id: string | null
    url: string | null
    isGenerating: boolean
    isLoading: boolean
    code: string
    error: string | null
}

interface SandboxContextType {
    sandbox: SandboxState
    updateCode: (code: string) => Promise<void>
    rerunCode: () => Promise<void>
    updateEnvVars: (vars: Record<string, string>) => Promise<void>
    initializeSandbox: () => Promise<string | null>
}

const SandboxContext = createContext<SandboxContextType | null>(null)

export function SandboxProvider({ children }: { children: React.ReactNode }) {
    const { session } = useAuth()
    const [sandbox, setSandbox] = useState<SandboxState>({
        id: null,
        url: null,
        isGenerating: false,
        isLoading: false,
        code: '',
        error: null
    })

    const initializeSandbox = useCallback(async () => {
        try {
            const runningSandboxes = await Sandbox.list()
            const existingSandbox = runningSandboxes.find(
                (sandbox: RunningSandbox) => sandbox.metadata?.userId === session?.user?.id
            )

            if (existingSandbox) {
                setSandbox(prev => ({ 
                    ...prev, 
                    id: existingSandbox.sandboxId 
                }))
                return existingSandbox.sandboxId
            }

            const metadata: SandboxMetadata = {
                userId: session?.user?.id || '',
                createdAt: new Date().toISOString()
            }

            const newSandbox = await Sandbox.create(metadata)
            setSandbox(prev => ({ ...prev, id: newSandbox.sandboxId }))
            return newSandbox.sandboxId
        } catch (error) {
            setSandbox(prev => ({ 
                ...prev, 
                error: 'Failed to initialize sandbox' 
            }))
            return null
        }
    }, [session?.user?.id])

    const updateCode = useCallback(async (code: string) => {
        if (!code) return

        try {
            setSandbox(prev => ({ 
                ...prev, 
                isGenerating: true,
                isLoading: true,
                code,
                error: null
            }))
            
            const response = await fetch('/api/sandbox/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metadata: {
                        userId: session?.user?.id,
                        createdAt: new Date().toISOString()
                    }
                })
            })
            
            if (!response.ok) throw new Error('Failed to initialize sandbox')
            const { sandboxId } = await response.json()

            const executeResponse = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })

            if (!executeResponse.ok) throw new Error('Failed to execute code')
            
            const data = await executeResponse.json()
            setSandbox(prev => ({
                ...prev,
                id: sandboxId,
                url: data.url,
                isGenerating: false,
                isLoading: false,
                error: null
            }))
        } catch (error) {
            console.error('Error updating code:', error)
            setSandbox(prev => ({
                ...prev,
                isGenerating: false,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to update app'
            }))
        }
    }, [session?.user?.id])

    const rerunCode = useCallback(async () => {
        if (sandbox.code) {
            await updateCode(sandbox.code)
        }
    }, [sandbox.code, updateCode])

    const updateEnvVars = useCallback(async (vars: Record<string, string>) => {
        if (!sandbox.id) return

        try {
            const response = await fetch(`/api/sandbox/${sandbox.id}/env`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ envVars: vars }),
            })

            if (!response.ok) throw new Error('Failed to update environment variables')
            await rerunCode()
        } catch (error) {
            setSandbox(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to update env vars'
            }))
        }
    }, [sandbox.id, rerunCode])

    useEffect(() => {
        if (session?.user?.id) {
            initializeSandbox()
        }
    }, [session?.user?.id, initializeSandbox])

    return (
        <SandboxContext.Provider value={{ 
            sandbox, 
            updateCode, 
            rerunCode, 
            updateEnvVars, 
            initializeSandbox 
        }}>
            {children}
        </SandboxContext.Provider>
    )
}

export function useSandbox() {
    const context = useContext(SandboxContext)
    if (!context) {
        throw new Error('useSandbox must be used within a SandboxProvider')
    }
    return context
} 
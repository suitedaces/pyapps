'use client'

import { createContext, useContext, useCallback, useState, useEffect } from 'react'
import { Sandbox } from '@/lib/sandbox'
import { useAuth } from './AuthContext'

export interface SandboxState {
    id: string | null
    url: string | null
    isGenerating: boolean
    code: string
    error: string | null
}

interface SandboxContextType {
    sandbox: SandboxState
    updateCode: (code: string) => Promise<void>
    updateEnvVars: (vars: Record<string, string>) => Promise<void>
}

const SandboxContext = createContext<SandboxContextType | null>(null)

export function SandboxProvider({ children }: { children: React.ReactNode }) {
    const { session } = useAuth()
    const [sandbox, setSandbox] = useState<SandboxState>({
        id: null,
        url: null,
        isGenerating: false,
        code: '',
        error: null
    })

    const updateCode = useCallback(async (code: string) => {
        if (!code || !session?.user?.id) return

        try {
            setSandbox(prev => ({ ...prev, isGenerating: true, error: null }))
            
            // First get/ensure sandbox ID
            let sandboxId = sandbox.id
            if (!sandboxId) {
                const initResponse = await fetch('/api/sandbox/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                if (!initResponse.ok) throw new Error('Failed to initialize sandbox')
                const { sandboxId: newId } = await initResponse.json()
                sandboxId = newId
                setSandbox(prev => ({ ...prev, id: newId }))
            }

            // Execute code in sandbox
            const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            })

            if (!response.ok) throw new Error('Failed to execute code')
            
            const data = await response.json()
            setSandbox(prev => ({
                ...prev,
                url: data.url,
                code,
                isGenerating: false,
                error: null
            }))
        } catch (error) {
            setSandbox(prev => ({
                ...prev,
                isGenerating: false,
                error: 'Failed to execute code'
            }))
        }
    }, [sandbox.id, session?.user?.id])

    const updateEnvVars = useCallback(async (vars: Record<string, string>) => {
        if (!sandbox.id) return

        try {
            const response = await fetch(`/api/sandbox/${sandbox.id}/env`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ envVars: vars })
            })

            if (!response.ok) throw new Error('Failed to update environment variables')
            
            // Re-run code to apply new env vars
            if (sandbox.code) {
                await updateCode(sandbox.code)
            }
        } catch (error) {
            setSandbox(prev => ({
                ...prev,
                error: 'Failed to update environment variables'
            }))
        }
    }, [sandbox.id, sandbox.code, updateCode])

    return (
        <SandboxContext.Provider value={{ 
            sandbox, 
            updateCode,
            updateEnvVars
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
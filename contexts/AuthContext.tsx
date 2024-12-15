'use client'

import { createClient } from '@/lib/supabase/client'
import { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'

interface AuthContextType {
    session: Session | null
    isLoading: boolean
    isPreviewMode: boolean
    showAuthPrompt: () => void
    hideAuthPrompt: () => void
    shouldShowAuthPrompt: boolean
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true,
    isPreviewMode: false,
    showAuthPrompt: () => {},
    hideAuthPrompt: () => {},
    shouldShowAuthPrompt: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [shouldShowAuthPrompt, setShouldShowAuthPrompt] = useState(false)
    const supabase = createClient()

    const showAuthPrompt = () => setShouldShowAuthPrompt(true)
    const hideAuthPrompt = () => setShouldShowAuthPrompt(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setIsLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setIsLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    return (
        <AuthContext.Provider 
            value={{ 
                session, 
                isLoading, 
                isPreviewMode: !session, 
                showAuthPrompt,
                hideAuthPrompt,
                shouldShowAuthPrompt
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)

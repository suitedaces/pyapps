"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { createClientComponentClient, Session } from '@supabase/auth-helpers-nextjs'

interface AuthContextType {
    session: Session | null
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true
})

export function AuthProvider({
    children
}: {
    children: React.ReactNode
}) {
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClientComponentClient()

    useEffect(() => {
        console.log('Auth Provider: Checking session...');

        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('Auth Provider: Session status:', !!session);
            setSession(session)
            setIsLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log('Auth Provider: Auth state changed:', !!session);
            setSession(session)
            setIsLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    return (
        <AuthContext.Provider value={{ session, isLoading }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)

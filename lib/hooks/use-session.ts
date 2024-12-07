'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

export function useSession() {
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const supabase = createClientComponentClient()

    useEffect(() => {
        console.log('Initializing session hook')
        
        async function getInitialSession() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()
                console.log('Initial session:', session, error)
                setSession(session)
            } catch (error) {
                console.error('Session error:', error)
            } finally {
                setIsLoading(false)
            }
        }

        getInitialSession()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log('Auth state changed:', _event, session)
            setSession(session)
            setIsLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    return { session, isLoading }
} 
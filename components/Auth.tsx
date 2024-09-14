'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

export default function Auth() {
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClientComponentClient()

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })
    }

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <div>
            {session ? (
                <div>
                    <p>Signed in as {session.user.email}</p>
                    <button onClick={signOut}>Sign Out</button>
                </div>
            ) : (
                <button onClick={signInWithGoogle}>Sign In with Google</button>
            )}
        </div>
    )
}

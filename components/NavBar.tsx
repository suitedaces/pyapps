'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

interface NavbarProps {
    isRightContentVisible: boolean
}

export function Navbar({ isRightContentVisible }: NavbarProps) {
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClientComponentClient()
    const [shareUrl, setShareUrl] = useState('')

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

    const handleSignOut = async () => {
        await supabase.auth.signOut()
    }

    const [windowWidth, setWindowWidth] = useState(0)

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth)
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const slideDistance = isRightContentVisible ? 0 : windowWidth / 8

    const generateShareUrl = () => {
        // This is a dummy function. Replace with actual URL generation logic.
        setShareUrl(
            `https://grunty.com/share/${Math.random().toString(36).substr(2, 9)}`
        )
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl)
        // You might want to add a toast notification here
    }

    return <></>
}

'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface NavbarProps {
    isRightContentVisible: boolean
}

export function Navbar({ isRightContentVisible }: NavbarProps) {
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
    }, [])

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

    return (
        <motion.nav
            className="bg-bg"
            animate={{ x: slideDistance }}
            transition={{ type: 'ease', stiffness: 300, damping: 30 }}
        >
            <div className="container mx-10 px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="font-bold text-xl text-black">
                            Grunty 🧐
                        </Link>
                    </div>
                    {session ? (
                        <></>
                    ) : (
                        <button
                            onClick={() =>
                                supabase.auth.signInWithOAuth({
                                    provider: 'google',
                                })
                            }
                            className="text-black hover:text-main"
                        >
                            Login
                        </button>
                    )}
                </div>
            </div>
        </motion.nav>
    )
}

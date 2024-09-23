'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Link as LinkIcon, Share } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

    const generateShareUrl = () => {
        // This is a dummy function. Replace with actual URL generation logic.
        setShareUrl(`https://grunty.com/share/${Math.random().toString(36).substr(2, 9)}`)
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl)
        // You might want to add a toast notification here
    }

    return (
        <nav className="bg-bg">
            <div className="2xl:container mx-auto px-4 sm:px-6 lg:px-20">
                <div className="flex justify-between items-center h-16">
                    <div className="flex-1 flex items-center">
                        <motion.div
                            animate={{ x: slideDistance }}
                            transition={{ type: 'ease', stiffness: 300, damping: 30 }}
                        >
                            <Link href="/" className="font-bold text-xl text-black">
                                Grunty 🧐
                            </Link>
                        </motion.div>
                    </div>
                    <div className="flex-1 flex justify-end items-center space-x-4">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="noShadow" size="icon" onClick={generateShareUrl}>
                                    <Share className="h-5 w-5" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md text-text rounded-lg p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-semibold">Share chat link</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-text mb-4">
                                    This link allows view-only access to this conversation.
                                </p>
                                <div className="flex items-center space-x-2 border-2 border-border rounded-full p-2">
                                    <Input
                                        className="flex-grow bg-transparent border-none text-text outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-none !important"
                                        value={shareUrl}
                                        readOnly
                                    />
                                    <Button
                                        variant="round"
                                        size="round"
                                        onClick={copyToClipboard}
                                        className="hover:bg-black hover:text-white"
                                    >
                                        Create link
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                        {session ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger>
                                    <div className="w-10 h-10 border-2 border-border rounded-full overflow-hidden">
                                        <Image
                                            src={session.user?.user_metadata?.avatar_url || '/default-avatar.png'}
                                            alt="User avatar"
                                            width={40}
                                            height={40}
                                        />
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <Link href="/settings">Settings</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleSignOut}>
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
            </div>
        </nav>
    )
}

import { Logo } from '@/components/core/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function AuthPrompt({ canClose = true }) {
    const { hideAuthPrompt } = useAuth()
    const supabase = createClient()
    const [isDarkMode, setIsDarkMode] = useState(false)

    useEffect(() => {
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }, [])

    const handleGoogleSignIn = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `https://pyapps.co/auth/callback`,
            },
        })
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-xl"
                onClick={canClose ? hideAuthPrompt : undefined}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ 
                        type: 'spring', 
                        damping: 25, 
                        stiffness: 200 
                    }}
                    className="w-full max-w-sm relative"
                    onClick={canClose ? (e) => e.stopPropagation() : undefined}
                >
                    <Card className="overflow-hidden border-[1.5px] bg-background/40 backdrop-blur-md shadow-2xl dark:border-white/20 border-black/20 dark:shadow-white/5">
                        {/* Ambient background gradients */}
                        <div className="absolute inset-0 opacity-30">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-transparent to-purple-500/30 animate-gradient" />
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 via-transparent to-rose-500/20 animate-gradient delay-150" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background/80 to-background" />
                        </div>

                        {/* Close button */}
                        {canClose && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                onClick={hideAuthPrompt}
                                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors z-10"
                            >
                                <X className="h-4 w-4" />
                            </motion.button>
                        )}

                        {/* Content */}
                        <div className="relative px-8 py-12 space-y-8">
                            {/* Logo and heading */}
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="space-y-6 text-center"
                            >
                                <div className="flex justify-center">
                                    <div className="relative">
                                        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 blur-xl rounded-full" />
                                        <Logo
                                            inverted={isDarkMode}
                                            className="w-28 relative"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        Build beautiful Python data apps in seconds
                                    </p>
                                </div>
                            </motion.div>

                            {/* Sign in button */}
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <Button
                                    size="lg"
                                    className="w-full relative group transition-all duration-300 bg-background/80 hover:bg-background border-[1.5px] dark:border-white/20 border-black/20 shadow-sm dark:shadow-white/5"
                                    onClick={handleGoogleSignIn}
                                >
                                    <div className="absolute left-4 transition-transform group-hover:scale-110">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium">
                                        Continue with Google
                                    </span>
                                </Button>
                            </motion.div>
                        </div>
                    </Card>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

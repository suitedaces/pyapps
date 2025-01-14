import { Logo } from '@/components/core/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export function AuthPrompt({ canClose = true }) {
    const { hideAuthPrompt } = useAuth()
    const supabase = createClient()

    const handleGoogleSignIn = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `http://localhost:3000/auth/callback`,
            },
        })
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
                onClick={canClose ? hideAuthPrompt : undefined}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="w-full max-w-md relative"
                    onClick={canClose ? (e) => e.stopPropagation() : undefined}
                >
                    <Card className="relative border-0 shadow-2xl overflow-hidden rounded-2xl bg-background/50 backdrop-blur-sm ring-1 ring-border/10">
                        <div className="absolute inset-0">
                            <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/10 via-transparent to-blue-500/10 dark:from-rose-500/5 dark:to-blue-500/5 animate-gradient" />
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-emerald-500/10 dark:from-purple-500/5 dark:to-emerald-500/5 animate-gradient delay-100" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background/50 to-background" />
                        </div>

                        <CardHeader className="relative z-10">
                            <div className="flex justify-end items-center">
                                {canClose && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={hideAuthPrompt}
                                        className="text-muted-foreground hover:bg-red-500/10 h-8 w-8"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-8 pb-8 relative z-10 px-8">
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="space-y-4 text-center"
                            >
                                <h2 className="text-2xl font-bold tracking-tight flex justify-center items-center">
                                    <motion.div
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                        className="relative"
                                    >
                                        <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/20 via-blue-500/20 to-purple-500/20 blur-sm" />
                                        <Logo
                                            inverted={
                                                window.matchMedia(
                                                    '(prefers-color-scheme: dark)'
                                                ).matches
                                            }
                                            className="w-32 relative"
                                        />
                                    </motion.div>
                                </h2>
                                <h3 className="text-pretty text-muted-foreground/80 text-base">
                                    Build Python data apps in seconds!
                                </h3>
                            </motion.div>
                        </CardContent>

                        <CardFooter className="relative z-10 pb-8 px-8">
                            <motion.div
                                className="w-full"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <Button
                                    size="lg"
                                    variant="secondary"
                                    className="w-full relative group hover:opacity-90 transition-all duration-200 rounded-xl border shadow-sm bg-background/80 backdrop-blur-sm hover:shadow-md hover:scale-[1.02]"
                                    onClick={handleGoogleSignIn}
                                >
                                    <div className="absolute left-4">
                                        <svg
                                            className="w-5 h-5"
                                            viewBox="0 0 24 24"
                                        >
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
                                    <span className="font-medium">
                                        Continue with Google
                                    </span>
                                </Button>
                            </motion.div>
                        </CardFooter>
                    </Card>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

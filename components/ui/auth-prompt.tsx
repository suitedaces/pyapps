import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"
import { Logo } from "@/components/core/Logo"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"

export function AuthPrompt() {
    const router = useRouter()
    const { hideAuthPrompt } = useAuth()
    const supabase = createClient()
    const { resolvedTheme } = useTheme()

    const handleGoogleSignIn = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`
            }
        })
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] backdrop-blur-sm bg-background/20"
                onClick={hideAuthPrompt}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="fixed inset-0 flex items-center justify-center p-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-full max-w-md relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-3xl blur-xl" />
                        <div className="relative bg-background/80 backdrop-blur-sm border border-border/50 shadow-2xl rounded-3xl overflow-hidden">
                            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-black/10" />
                            <div className="relative p-6 flex flex-col items-center gap-6">
                                <div className="space-y-2 text-center">
                                    <h3 className="text-2xl font-semibold tracking-tight flex justify-center">
                                        <Logo 
                                            className="w-32 h-auto mb-2" 
                                            inverted={resolvedTheme === 'dark'}
                                        />
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Build production-ready analytics apps with pure English.
                                    </p>
                                </div>
                                <div className="w-full">
                                    <Button 
                                        size="lg"
                                        variant="outline"
                                        className="w-full flex items-center justify-center gap-2 hover:bg-accent"
                                        onClick={handleGoogleSignIn}
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                        </svg>
                                        Continue with Google
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
} 
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles } from "lucide-react"

export function AuthPrompt() {
    const router = useRouter()

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md"
            >
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="w-full max-w-md relative"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-purple-500/30 rounded-3xl blur-xl" />
                        <Alert className="relative overflow-hidden border-0 bg-background/95 shadow-2xl rounded-3xl">
                            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-black/10" />
                            <div className="relative p-6 flex flex-col items-center gap-6">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Sparkles className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-2 text-center">
                                    <h3 className="text-2xl font-semibold tracking-tight">
                                        Ready to Create?
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Sign in to save your progress and continue building amazing apps
                                    </p>
                                </div>
                                <div className="w-full space-y-3">
                                    <Button 
                                        size="lg"
                                        className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                                        onClick={() => router.push('/login')}
                                    >
                                        Sign In to Continue
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => router.push('/signup')}
                                    >
                                        Don't have an account? Sign up
                                    </Button>
                                </div>
                            </div>
                        </Alert>
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
} 
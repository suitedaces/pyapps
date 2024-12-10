'use client'

import Lottie from 'lottie-react'
import { motion } from 'framer-motion'
import rocketAnimation from '@/public/rocket.json'

interface LoadingSandboxProps {
    message: string
}

export default function LoadingSandbox({ message }: LoadingSandboxProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10"
        >
            <motion.div 
                className="flex flex-col items-center gap-6"
                initial={{ scale: 0.5, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.6 }}
            >
                <div className="w-32 h-32">
                    <Lottie 
                        animationData={rocketAnimation} 
                        loop={true}
                        className="w-full h-full"
                    />
                </div>
                <motion.p 
                    className="text-lg text-muted-foreground font-medium"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {message}
                </motion.p>
            </motion.div>
        </motion.div>
    )
} 
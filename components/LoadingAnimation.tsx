'use client'

import { motion } from 'framer-motion'
import './rubik-cube/rubik.css'

interface LoadingAnimationProps {
    message: string
}

export default function LoadingAnimation({ message }: LoadingAnimationProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10"
        >
            <motion.div
                className="flex flex-col items-center gap-6 loading-container"
                initial={{ scale: 0.5, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', duration: 0.6 }}
            >
                <div className="container" style={{ transform: 'scale(0.5)' }}>
                    <div className="rubiks-cube rubiks-cube-1">
                        {Array.from({ length: 27 }, (_, i) => (
                            <div key={i} className="detail">
                                <div className="side front" />
                                <div className="side back" />
                                <div className="side top" />
                                <div className="side bottom" />
                                <div className="side left" />
                                <div className="side right" />
                            </div>
                        ))}
                    </div>
                    <div className="reflection">
                        <div className="rubiks-cube rubiks-cube-1">
                            {Array.from({ length: 27 }, (_, i) => (
                                <div key={i} className="detail">
                                    <div className="side front" />
                                    <div className="side back" />
                                    <div className="side top" />
                                    <div className="side bottom" />
                                    <div className="side left" />
                                    <div className="side right" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <motion.p
                    className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400 dark:from-cyan-300 dark:to-indigo-300"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                        delay: 0.3,
                        duration: 0.5,
                        ease: "easeOut"
                    }}
                >
                    {message}
                </motion.p>
            </motion.div>
        </motion.div>
    )
}

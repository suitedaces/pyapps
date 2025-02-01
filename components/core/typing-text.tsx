'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface TypingTextProps {
    text: string
    speed?: number
    className?: string
    show: boolean
}

export function TypingText({
    text,
    speed = 30,
    className,
    show,
}: TypingTextProps) {
    const [displayText, setDisplayText] = useState('')
    const [isTyping, setIsTyping] = useState(true)

    useEffect(() => {
        let currentIndex = 0

        const typeText = () => {
                if (currentIndex < text.length) {
                    setDisplayText(text.slice(0, currentIndex + 1))
                    currentIndex++
                    setTimeout(typeText, speed)

            } else {
                setIsTyping(false)
            }
        }

        if (show) {
            typeText()
        }

        return () => {
            setDisplayText('')
            setIsTyping(true)
        }
    }, [text, speed, show])

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute inset-0 flex items-center w-full justify-center pb-96 z-50 pointer-events-none"
                >
                    <p className={`${className} flex items-center`}>
                            <span className="animate-fade-in">{displayText}</span>
                        {isTyping && (
                            <span
                                className="ml-[2px] w-[2px] h-[1.2em] bg-current animate-cursor-blink"
                                style={{
                                    display: 'inline-block',
                                    verticalAlign: 'middle',
                                }}
                            />
                        )}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

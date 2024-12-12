import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { enableDeprecationWarnings, BundledLanguage, createHighlighter } from 'shiki'

enableDeprecationWarnings()
interface CodeViewProps {
    code: string | { code: string }
    isGeneratingCode: boolean
    language?: BundledLanguage
}

const LoadingSandbox = dynamic(
    () => import('./LoadingSandbox'),
    { ssr: false }
)

const CODE_THEMES = {
    dark: {
        primary: 'github-dark-high-contrast',
        alternate: 'github-dark-default',
        extra: 'ayu-dark'
    },
    light: {
        primary: 'github-light'
    }
} as const

export function CodeView({
    code,
    isGeneratingCode,
    language = 'python'
}: CodeViewProps) {
    const [displayCode, setDisplayCode] = useState('')
    const [highlightedHtml, setHighlightedHtml] = useState('')

    const codeRef = useRef('')
    const containerRef = useRef<HTMLDivElement>(null)

    // Initialize Shiki highlighter with dual themes
    useEffect(() => {
        const initHighlighter = async () => {
            // Saare themes ko flat array me convert karte hai
            const allThemes = [
                ...Object.values(CODE_THEMES.dark),
                ...Object.values(CODE_THEMES.light)
            ]

            const highlighter = await createHighlighter({
                langs: [language],
                themes: allThemes
            })

            if (displayCode) {
                const html = highlighter.codeToHtml(displayCode, {
                    lang: language,
                    themes: {
                        light: CODE_THEMES.light.primary,
                        dark: CODE_THEMES.dark.primary
                    },
                })
                setHighlightedHtml(html)
            }
        }

        initHighlighter()
    }, [displayCode, language])

    // Handle streaming code updates
    useEffect(() => {
        if (code) {
            const newCode = typeof code === 'object' && 'code' in code
                ? code.code
                : String(code)

            codeRef.current = newCode
            setDisplayCode(newCode)

            // Auto-scroll to bottom
            if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight
            }
        }
    }, [code])

    if (isGeneratingCode && !displayCode) {
        return <LoadingSandbox message="Generating code..." />
    }

    return (
        <Card className="bg-bg border-border h-full max-h-[82vh] flex-grow relative">
            <CardContent className="p-0 h-full">
                <div
                    ref={containerRef}
                    className="overflow-auto h-full p-4 font-mono text-sm"
                >
                    <div
                        className="min-w-max relative shiki-container"
                        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                    />

                    <AnimatePresence>
                        {isGeneratingCode && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/10 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg"
                            >
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-sm font-medium">
                                    Generating code...
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isGeneratingCode && (
                        <motion.div
                            className="absolute bottom-0 right-0 w-2 h-4 bg-primary/50"
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

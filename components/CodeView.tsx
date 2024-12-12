import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { enableDeprecationWarnings, BundledLanguage, createHighlighter } from 'shiki'

enableDeprecationWarnings()
interface CodeViewProps {
    code: string | { code: string }
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
                </div>
            </CardContent>
        </Card>
    )
}

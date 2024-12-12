import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { enableDeprecationWarnings, BundledLanguage, createHighlighter } from 'shiki'
// import { generate } from '@/lib/actions'
import { readStreamableValue } from 'ai/rsc'
import { generate } from '@/lib/actions'

// import { type AI } from '@/lib/ai-config'

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

interface CodeViewState {
    displayCode: string
    isStreaming: boolean
    error: string | null
}

export function CodeView({
    code,
    language = 'python'
}: CodeViewProps) {
    const [displayCode, setDisplayCode] = useState('')
    const [highlightedHtml, setHighlightedHtml] = useState('')

    const [state, setState] = useState<CodeViewState>({
        displayCode: '',
        isStreaming: false,
        error: null
    })

    // const handleCodeStreaming = async () => {
    //     try {
    //         const { delta } = await generate()

    //         for await (const chunk of readStreamableValue(delta)) {
    //             console.log('📥 Stream Update:', {
    //                 chunk,
    //                 timestamp: new Date().toISOString()
    //             })

    //             setDisplayCode(prev => prev + chunk);

    //         }
    //     } catch (error) {
    //         console.error('Error in streaming:', error)
    //         setState(prev => ({
    //             ...prev,
    //             error: 'Error streaming code',
    //             isStreaming: false
    //         }))
    //     }
    // }

    useEffect(() => {
        handleCodeStreaming()
    },)

    useEffect(() => {
        if (!state.isStreaming && code) {
            const finalCode = typeof code === 'object' && 'code' in code
                ? code.code
                : String(code)

            setState(prev => ({
                ...prev,
                displayCode: finalCode
            }))
        }
    }, [code, state.isStreaming])

    const handleCodeStreaming = async () => {
        try {
            setState(prev => ({
                ...prev,
                displayCode: ''
            }))

            const streamable = await generate()
            let accumulatedCode = ''

            // Read and process the stream
            for await (const chunk of readStreamableValue(streamable)) {
                console.log('📥 Stream Update:', {
                    chunk,
                    timestamp: new Date().toISOString()
                })

                const cleanChunk = String(chunk).replace(/\[object Object\]/g, '')
                accumulatedCode += cleanChunk

                setState(prev => ({
                    ...prev,
                    displayCode: accumulatedCode,
                    isStreaming: true,
                }))
            }

            setState(prev => ({
                ...prev,
                displayCode: accumulatedCode,
                isStreaming: false
            }))
        } catch (error) {
            console.error('Error in streaming:', error)
            setState(prev => ({
                ...prev,
                error: 'Error streaming code',
                isStreaming: false
            }))
        }
    }

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

            // Update state with new code
            setState(prev => ({
                ...prev,
                displayCode: newCode
            }))

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

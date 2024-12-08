import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { highlight, languages } from 'prismjs'
import { useEffect, useRef, useState } from 'react'
import Editor from 'react-simple-code-editor'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'

import 'prismjs/components/prism-python'
import 'prismjs/themes/prism-tomorrow.css'

interface CodeViewProps {
    code: string | { code: string }
    isGeneratingCode: boolean
}

const LoadingSandbox = dynamic(
    () => import('./LoadingSandbox'),
    { ssr: false }
)

export function CodeView({ code, isGeneratingCode }: CodeViewProps) {
    const [displayCode, setDisplayCode] = useState('')
    const codeRef = useRef('')
    const editorRef = useRef<HTMLDivElement>(null)

    // Handle streaming code updates
    useEffect(() => {
        if (code) {
            const newCode = typeof code === 'object' && 'code' in code
                ? code.code
                : String(code)

            // Update ref immediately for any comparisons
            codeRef.current = newCode

            // Smoothly update display code
            setDisplayCode(newCode)

            // Scroll to bottom of editor when new code arrives
            if (editorRef.current) {
                const editor = editorRef.current.querySelector('textarea')
                if (editor) {
                    editor.scrollTop = editor.scrollHeight
                }
            }
        }
    }, [code])

    // Loading overlay for initial generation
    if (isGeneratingCode && !displayCode) {
        return <LoadingSandbox message="Generating code..." />
    }

    return (
        <Card className="bg-bg border-border h-full max-h-[82vh] flex-grow relative">
            <CardContent className="p-0 h-full">
                <div className="overflow-auto h-full code-container" ref={editorRef}>
                    <div className="min-w-max relative">
                        <Editor
                            value={displayCode}
                            onValueChange={() => {}}
                            highlight={(codeToHighlight) => {
                                try {
                                    return highlight(
                                        String(codeToHighlight),
                                        languages.python,
                                        'python'
                                    )
                                } catch (error) {
                                    console.error('Highlighting error:', error)
                                    return String(codeToHighlight)
                                }
                            }}
                            padding={16}
                            style={{
                                fontFamily: '"Fira code", "Fira Mono", monospace',
                                fontSize: 14,
                                lineHeight: 1.5,
                                minHeight: '100%',
                                backgroundColor: 'transparent',
                                color: '#000',
                            }}
                            className="w-full h-full custom-editor"
                            readOnly={true}
                        />

                        {/* Streaming indicator */}
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

                        {/* Cursor effect for streaming */}
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
                </div>
            </CardContent>
            <style jsx global>{`
                .code-container {
                    height: 100%;
                }
                .custom-editor {
                    height: 100%;
                }
                .custom-editor textarea,
                .custom-editor pre {
                    white-space: pre !important;
                    min-height: 100% !important;
                }
                .code-container::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .code-container::-webkit-scrollbar-track {
                    background: #e5e6e9;
                }
                .code-container::-webkit-scrollbar-thumb {
                    background: #212121;
                    border-radius: 4px;
                }
                .code-container::-webkit-scrollbar-thumb:hover {
                    background: #1b1b1b;
                }
                .code-container {
                    scrollbar-width: thin;
                    scrollbar-color: #212121 #e5e6e9;
                }
                .custom-editor {
                    padding: 1rem !important;
                }
                .custom-editor pre,
                .custom-editor textarea {
                    color: #000 !important;
                }
            `}</style>
        </Card>
    )
}
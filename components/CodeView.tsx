import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { highlight, languages } from 'prismjs'
import { useEffect, useState } from 'react'
import Editor from 'react-simple-code-editor'

import { experimental_useObject as useObject } from 'ai/react'

import 'prismjs/components/prism-python'
import 'prismjs/themes/prism-tomorrow.css'
import { LoadingSandbox } from '@/components/LoadingSandbox'

interface CodeViewProps {
    code: string | undefined
    isGeneratingCode: boolean
}

interface CodeViewState {
    displayCode: string
    isStreaming: boolean
    error: string | null
}

export function CodeView({ code, isGeneratingCode }: CodeViewProps) {
    const [displayCode, setDisplayCode] = useState('')
    const [state, setState] = useState<CodeViewState>({
        displayCode: '',
        isStreaming: false,
        error: null
    })

    // useEffect(() => {
    //     if (!state.isStreaming && code) {
    //         const finalCode = typeof code === 'object' && 'code' in code
    //             ? code.code
    //             : String(code)

    //         setState(prev => ({
    //             ...prev,
    //             displayCode: finalCode
    //         }))
    //     }
    // }, [code, state.isStreaming])

    // useEffect(() => {
    //     if (code && !isGeneratingCode) {
    //         try {
    //             const codeStr = typeof code === 'object' && 'code' in code
    //                 ? code.code
    //                 : String(code)

    //             const formattedCode = codeStr
    //                 .split('\n')
    //                 .map((line) => line.trim())
    //                 .join('\n')
    //             setDisplayCode(formattedCode)
    //             console.log('Code type:', typeof code)
    //             console.log('Formatted code:', formattedCode)
    //         } catch (error) {
    //             console.error('Error formatting code:', error)
    //             setDisplayCode(typeof code === 'string' ? code : '')
    //         }
    //     } else if (!code) {
    //         setDisplayCode('')
    //     }
    // }, [code, isGeneratingCode])

    return (
        <Card className="bg-bg border-border h-full max-h-[82vh] flex-grow">
            <CardContent className="p-0 h-full relative">
                <div className="overflow-auto h-full code-container">
                    <div className="min-w-max">
                        <Editor
                            value={state.displayCode || ''}
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
                                fontFamily:
                                    '"Fira code", "Fira Mono", monospace',
                                fontSize: 14,
                                lineHeight: 1.5,
                                minHeight: '100%',
                                backgroundColor: 'transparent',
                                color: '#000',
                            }}
                            className="w-full h-full custom-editor"
                            readOnly={true}
                        />
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
                /* Token colors for syntax highlighting */
                .token.comment {
                    color: #6b7280;
                }
                .token.string {
                    color: #059669;
                }
                .token.number {
                    color: #7c3aed;
                }
                .token.keyword {
                    color: #2563eb;
                }
                .token.function {
                    color: #0284c7;
                }
            `}</style>
        </Card>
    )
}

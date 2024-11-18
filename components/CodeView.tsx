import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { highlight, languages } from 'prismjs'
import Editor from 'react-simple-code-editor'
import { useState, useEffect } from 'react'

import 'prismjs/components/prism-python'
import 'prismjs/themes/prism-tomorrow.css'

interface CodeViewProps {
    code: string
    isGeneratingCode: boolean
}

export function CodeView({ code, isGeneratingCode }: CodeViewProps) {
    const [displayCode, setDisplayCode] = useState(code)

    useEffect(() => {
        if (code) {
            const formattedCode = code
                .split('\n')
                .map(line => line.trim())
                .join('\n')
            setDisplayCode(formattedCode)
        }
    }, [code, isGeneratingCode])

    if (isGeneratingCode) {
        return (
            <Card className="bg-white border-border h-full">
                <CardContent className="p-0 h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-text" />
                        <p className="text-sm text-text">
                            Generating code...
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!displayCode) {
        return (
            <Card className="bg-white border-border h-full">
                <CardContent className="p-0 h-full flex items-center justify-center">
                    <p className="text-sm text-text">
                        No code generated yet
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-bg border-border h-full max-h-[82vh] flex-grow">
            <CardContent className="p-0 h-full relative">
                <div className="overflow-auto h-full code-container">
                    <div className="min-w-max">
                        <Editor
                            value={displayCode}
                            onValueChange={() => { }}
                            highlight={code =>
                                highlight(code, languages.python, 'python')
                            }
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
                    background: #E5E6E9;
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
                    scrollbar-color: #212121 #E5E6E9;
                }
                .custom-editor {
                    padding: 1rem !important;
                }
                .custom-editor pre,
                .custom-editor textarea {
                    color: #000 !important;
                }
                /* Token colors for syntax highlighting */
                .token.comment { color: #6b7280; }
                .token.string { color: #059669; }
                .token.number { color: #7c3aed; }
                .token.keyword { color: #2563eb; }
                .token.function { color: #0284c7; }
            `}</style>
        </Card>
    )
}

import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-python'
import 'prismjs/themes/prism-tomorrow.css'
import Editor from 'react-simple-code-editor'

interface CodeViewProps {
    code: string
    isGeneratingCode: boolean
}

export function CodeView({ code, isGeneratingCode }: CodeViewProps) {
    if (isGeneratingCode) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm text-muted-foreground">
                        Generating Streamlit code...
                    </p>
                </div>
            </div>
        )
    }

    if (!code) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                    No code generated yet
                </p>
            </div>
        )
    }

    return (
        <Card className="bg-gray-900 border border-gray-700 h-full max-h-[82vh] flex-grow rounded-lg shadow-lg">
            <CardContent className="p-0 h-full overflow-auto relative">
                <Editor
                    value={code}
                    onValueChange={() => {}}
                    highlight={(code: string) =>
                        highlight(code, languages.python, 'python')
                    }
                    padding={16}
                    style={{
                        fontFamily: '"Fira code", "Fira Mono", monospace',
                        fontSize: 14,
                        lineHeight: 1.5,
                        minHeight: '100%',
                        overflow: 'auto',
                    }}
                    readOnly={true}
                />
            </CardContent>
        </Card>
    )
}

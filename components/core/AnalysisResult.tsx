import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Code } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'

interface AnalysisResultProps {
    code: string
    results: Array<{
        type: 'stdout' | 'stderr' | 'image' | 'error'
        content: string
        mimeType?: string
    }>
    isLoading?: boolean
    error?: {
        name: string
        value: string
        traceback: string
    }
}

export function AnalysisResult({ code, results, isLoading, error }: AnalysisResultProps) {
    const [isCodeVisible, setIsCodeVisible] = useState(false)

    return (
        <div className="rounded-lg border border-border p-4 space-y-4">
            {isLoading ? (
                <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    <span>Analyzing data...</span>
                </div>
            ) : (
                <>
                    <Collapsible open={isCodeVisible} onOpenChange={setIsCodeVisible}>
                        <div className="flex items-center justify-between">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-2">
                                    <Code className="h-4 w-4" />
                                    View Code
                                    {isCodeVisible ? (
                                        <ChevronUp className="h-4 w-4" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                            <pre className="mt-4 p-4 bg-muted rounded-lg overflow-x-auto">
                                <code>{code}</code>
                            </pre>
                        </CollapsibleContent>
                    </Collapsible>

                    <div className="space-y-4">
                        {error ? (
                            <div className="text-destructive bg-destructive/10 p-4 rounded-lg">
                                <h4 className="font-bold">Error: {error.name}</h4>
                                <pre className="mt-2 whitespace-pre-wrap text-sm">
                                    {error.traceback}
                                </pre>
                            </div>
                        ) : (
                            results.map((result, index) => {
                                if (result.type === 'image') {
                                    return (
                                        <div key={index} className="overflow-auto">
                                            <img 
                                                src={`data:${result.mimeType};base64,${result.content}`}
                                                alt="Analysis result"
                                                className="max-w-full"
                                            />
                                        </div>
                                    )
                                }

                                if (result.type === 'error') {
                                    return (
                                        <div key={index} className="text-destructive bg-destructive/10 p-4 rounded-lg">
                                            <pre className="whitespace-pre-wrap text-sm">
                                                {result.content}
                                            </pre>
                                        </div>
                                    )
                                }

                                return (
                                    <pre 
                                        key={index}
                                        className={cn(
                                            "p-4 rounded-lg whitespace-pre-wrap text-sm",
                                            result.type === 'stderr' && "text-destructive bg-destructive/10",
                                            result.type === 'stdout' && "bg-muted"
                                        )}
                                    >
                                        {result.content}
                                    </pre>
                                )
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    )
} 
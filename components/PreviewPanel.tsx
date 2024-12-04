import {
    StreamlitPreview,
    StreamlitPreviewRef,
} from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Code, Globe, Layout, RefreshCcw } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { CodeView } from './CodeView'

interface PreviewPanelProps {
    streamlitUrl: string | null
    generatedCode: string
    isGeneratingCode: boolean
    isInitializing?: boolean
    showCodeView: boolean
    onRefresh?: () => void
    onCodeViewToggle?: () => void
}

export interface PreviewPanelRef {
    refreshIframe: () => void
}

export const PreviewPanel = forwardRef<PreviewPanelRef, PreviewPanelProps>(({
    streamlitUrl,
    generatedCode,
    isGeneratingCode,
    isInitializing,
    showCodeView,
    onRefresh,
    onCodeViewToggle,
}, ref) => {
    const streamlitPreviewRef = useRef<StreamlitPreviewRef>(null)

    useImperativeHandle(ref, () => ({
        refreshIframe: () => {
            if (streamlitPreviewRef.current) {
                streamlitPreviewRef.current.refreshIframe()
            }
        }
    }))

    // Only refresh when URL changes and is not null
    useEffect(() => {
        if (streamlitUrl && !isGeneratingCode) {
            const timeoutId = setTimeout(() => {
                streamlitPreviewRef.current?.refreshIframe()
            }, 1000)
            return () => clearTimeout(timeoutId)
        }
    }, [streamlitUrl, isGeneratingCode])

    const handleRefresh = () => {
        if (streamlitPreviewRef.current) {
            streamlitPreviewRef.current.refreshIframe()
        }
        onRefresh?.()
    }

    return (
        <div className="relative h-full">
            <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 p-2 border-b bg-muted/40">
                    <div className="flex items-center flex-grow gap-2 px-2 py-1.5 bg-background rounded-md border shadow-sm">
                        <Globe className="h-4 w-4 text-foreground/90" />
                        <Input
                            value={streamlitUrl || ''}
                            readOnly
                            className="flex-grow font-mono text-sm border-0 focus-visible:ring-0 px-0 py-0 h-auto bg-transparent text-foreground selection:bg-blue-200"
                        />
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleRefresh}
                                    className="hover:bg-background"
                                    disabled={isGeneratingCode}
                                >
                                    <RefreshCcw
                                        className={cn(
                                            'h-4 w-4 text-foreground/90',
                                            isGeneratingCode && 'animate-spin'
                                        )}
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Refresh App</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onCodeViewToggle}
                                    className={cn(
                                        'hover:bg-background',
                                        showCodeView && 'bg-background text-primary'
                                    )}
                                >
                                    {showCodeView ? (
                                        <Layout className="h-4 w-4 text-foreground/90" />
                                    ) : (
                                        <Code className="h-4 w-4 text-foreground/90" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{showCodeView ? 'Show App' : 'Show Code'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="flex-grow relative">
                    {showCodeView ? (
                        <div className="h-full overflow-auto">
                            <CodeView
                                code={generatedCode}
                                isGeneratingCode={isGeneratingCode}
                            />
                        </div>
                    ) : (
                        <StreamlitPreview
                            ref={streamlitPreviewRef}
                            url={streamlitUrl}
                            isGeneratingCode={isGeneratingCode}
                        />
                    )}
                </div>
            </div>
        </div>
    )
})

PreviewPanel.displayName = 'PreviewPanel'

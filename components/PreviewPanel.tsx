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
import { AnimatePresence } from 'framer-motion'
import { Code, Globe, Layout, RefreshCcw } from 'lucide-react'
import dynamic from 'next/dynamic'
import React, { useRef } from 'react'
import { CodeView } from './CodeView'

// Dynamically import LoadingSandbox with SSR disabled
const LoadingAnimation = dynamic(() => import('./LoadingAnimation'), {
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="animate-pulse">Loading...</div>
        </div>
    ),
})

interface PreviewPanelProps {
    streamlitUrl: string | null
    appId?: string
    generatedCode: string
    isGeneratingCode: boolean
    isLoadingSandbox: boolean
    showCodeView: boolean
    onRefresh: () => void
    onCodeViewToggle: () => void
}

export const PreviewPanel = React.forwardRef<
    { refreshIframe: () => void },
    PreviewPanelProps
>(
    (
        {
            streamlitUrl,
            appId,
            generatedCode,
            isGeneratingCode,
            isLoadingSandbox,
            showCodeView,
            onRefresh,
            onCodeViewToggle,
        },
        ref
    ) => {
        const streamlitPreviewRef = useRef<StreamlitPreviewRef>(null)

        React.useImperativeHandle(ref, () => ({
            refreshIframe: () => {
                if (streamlitPreviewRef.current) {
                    streamlitPreviewRef.current.refreshIframe()
                }
            },
        }))
        const showOverlay = isGeneratingCode || isLoadingSandbox

        const displayUrl = appId
            ? `${process.env.NEXT_PUBLIC_BASE_URL || ''}/apps/${appId}`
            : null

        const handleRefresh = () => {
            if (streamlitPreviewRef.current) {
                streamlitPreviewRef.current.refreshIframe()
            }
            onRefresh?.()
        }

        return (
            <div className="relative flex flex-col h-full z-40">
                <AnimatePresence>
                    {showOverlay && (
                        <LoadingAnimation
                            message={
                                isLoadingSandbox
                                    ? 'Preparing your sandbox...'
                                    : 'Generating your code...'
                            }
                        />
                    )}
                </AnimatePresence>
                <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 p-2 border-b bg-muted/40">
                        <div className="flex items-center flex-grow gap-2 px-2 py-1.5 bg-background rounded-md border shadow-sm">
                            <Globe className="h-4 w-4 text-foreground/90" />
                            <Input
                                value={displayUrl || ''}
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
                                                isGeneratingCode &&
                                                    'animate-spin'
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
                                            showCodeView &&
                                                'bg-background text-primary'
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
                                    <p>
                                        {showCodeView
                                            ? 'Show App'
                                            : 'Show Code'}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="flex-1 min-h-0">
                        {showCodeView ? (
                            <div className="h-full">
                                {isGeneratingCode ? (
                                    <LoadingAnimation message="Generating code..." />
                                ) : (
                                    <CodeView
                                        code={generatedCode}
                                        isGeneratingCode={isGeneratingCode}
                                        containerClassName="h-full"
                                    />
                                )}
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
    }
)

PreviewPanel.displayName = 'PreviewPanel'

import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Globe } from 'lucide-react'
import { useRef, forwardRef, useImperativeHandle } from 'react'

interface StreamlitPreviewProps {
    url: string | null
    isGeneratingCode: boolean
}

export interface StreamlitPreviewRef {
    refreshIframe: () => void
}

export const StreamlitPreview = forwardRef<StreamlitPreviewRef, StreamlitPreviewProps>(({ 
    url, 
    isGeneratingCode
}, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Expose refreshIframe method through ref
    useImperativeHandle(ref, () => ({
        refreshIframe: () => {
            if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src
            }
        }
    }))

    const content = (
        <div className="h-full relative">
            {isGeneratingCode && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div className="absolute -bottom-1 -right-1 h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">
                            Refreshing app...
                        </p>
                    </div>
                </div>
            )}
            {!url ? (
                <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Globe className="h-8 w-8 text-muted-foreground animate-pulse" />
                        <p className="text-sm text-muted-foreground font-medium">
                            Waiting for app to start...
                        </p>
                    </div>
                </div>
            ) : (
                <iframe
                    ref={iframeRef}
                    src={url}
                    className="w-full h-full border-0"
                    allow="accelerometer; camera; gyroscope; microphone"
                />
            )}
        </div>
    );

    return (
        <Card className="bg-background h-full">
            <CardContent className="p-0 h-full">
                {content}
            </CardContent>
        </Card>
    );
})

StreamlitPreview.displayName = 'StreamlitPreview'

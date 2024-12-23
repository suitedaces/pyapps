import { Card, CardContent } from '@/components/ui/card'
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
} from 'react'

interface StreamlitPreviewProps {
    url: string | null
    isGeneratingCode: boolean
}

export interface StreamlitPreviewRef {
    refreshIframe: () => void
}

export const StreamlitPreview = forwardRef<
    StreamlitPreviewRef,
    StreamlitPreviewProps
>(({ url }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const retryTimeoutRef = useRef<NodeJS.Timeout>()
    const previousUrlRef = useRef<string | null>(null)

    // Function to refresh iframe
    const refreshIframe = () => {
        if (iframeRef.current) {
            iframeRef.current.src = iframeRef.current.src
        }
    }

    // Expose refreshIframe method through ref
    useImperativeHandle(ref, () => ({
        refreshIframe,
    }))

    const content = useMemo(() => {
        if (!url) {
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">
                        Nothing to show.
                    </p>
                </div>
            )
        }

        return (
            <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                allow="camera"
            />
        )
    }, [url])

    return (
        <Card className="bg-background h-full">
            <CardContent className="p-0 h-full">{content}</CardContent>
        </Card>
    )
})

StreamlitPreview.displayName = 'StreamlitPreview'

'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import {
    forwardRef,
    useImperativeHandle,
    useRef,
} from 'react'

export interface StreamlitFrameRef {
    refreshIframe: () => void
}

interface StreamlitFrameProps {
    url: string
    isLoading?: boolean
}

const StreamlitFrame = forwardRef<StreamlitFrameRef, StreamlitFrameProps>(
    function StreamlitFrame({ url, isLoading }, ref) {
        const iframeRef = useRef<HTMLIFrameElement>(null)

        const refreshIframe = () => {
            if (iframeRef.current) {
                iframeRef.current.src = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
            }
        }

        useImperativeHandle(
            ref,
            () => ({
                refreshIframe,
            }),
            [url]
        )

        return (
            <div className="relative w-full h-[calc(100vh-3.5rem)]">
                <iframe
                    ref={iframeRef}
                    id="streamlit-iframe"
                    src={url}
                    className={cn(
                        'w-full h-full border-0',
                        isLoading && 'blur-sm transition-all duration-200'
                    )}
                    allow="camera"
                />
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-dark-app/50 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    </div>
                )}
            </div>
        )
    }
)

StreamlitFrame.displayName = 'StreamlitFrame'

export { StreamlitFrame }

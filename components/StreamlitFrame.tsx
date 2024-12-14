'use client'

import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StreamlitFrameRef {
    refreshIframe: () => void
}

interface StreamlitFrameProps {
    url: string
}

const StreamlitFrame = forwardRef<StreamlitFrameRef, StreamlitFrameProps>(
    function StreamlitFrame({ url }, ref) {
        const iframeRef = useRef<HTMLIFrameElement>(null)
        const [isLoading, setIsLoading] = useState(true)
        const [isInitialLoad, setIsInitialLoad] = useState(true)

        const refreshIframe = () => {
            if (iframeRef.current) {
                setIsLoading(true)
                iframeRef.current.src = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
            }
        }

        useImperativeHandle(ref, () => ({
            refreshIframe
        }), [url])

        useEffect(() => {
            const timer = setTimeout(() => {
                refreshIframe()
                setIsInitialLoad(false)
            }, 3000)

            return () => clearTimeout(timer)
        }, [url])

        const handleIframeLoad = () => {
            if (!isInitialLoad) {
                setIsLoading(false)
            }
        }

        return (
            <div className="relative w-full h-[calc(100vh-3.5rem)]">
                <iframe
                    ref={iframeRef}
                    id="streamlit-iframe"
                    src={url}
                    className={cn(
                        "w-full h-full border-0",
                        (isLoading || isInitialLoad) && "blur-sm transition-all duration-200"
                    )}
                    allow="camera"
                    onLoad={handleIframeLoad}
                />
                {(isLoading || isInitialLoad) && (
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
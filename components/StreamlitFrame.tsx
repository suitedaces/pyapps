'use client'

interface StreamlitFrameProps {
    url: string
}

export function StreamlitFrame({ url }: StreamlitFrameProps) {
    return (
        <iframe
            id="streamlit-iframe"
            src={url}
            className="w-full h-[calc(100vh-3.5rem)] border-0"
            allow="camera"
        />
    )
}
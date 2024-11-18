import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface StreamlitPreviewProps {
    url: string | null
    isGeneratingCode: boolean
}

export function StreamlitPreview({ url, isGeneratingCode }: StreamlitPreviewProps) {
    if (isGeneratingCode) {
        return (
            <Card className="bg-white border-border h-full">
                <CardContent className="p-0 h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-text" />
                        <p className="text-sm text-text">
                            Generating Streamlit app...
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!url) {
        return (
            <Card className="bg-white border-border h-full">
                <CardContent className="p-0 h-full flex items-center justify-center">
                    <p className="text-sm text-text">
                        Waiting for Streamlit app to start...
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-white border-border h-full max-h-[82vh] flex-grow">
            <CardContent className="p-0 h-full relative">
                <div className="h-full overflow-auto streamlit-container">
                    <iframe
                        src={url}
                        className="w-full h-full border-0"
                        allow="accelerometer; camera; gyroscope; microphone"
                    />
                </div>
            </CardContent>
            <style jsx global>{`
                .streamlit-container {
                    height: 100%;
                }
                .streamlit-container::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .streamlit-container::-webkit-scrollbar-track {
                    background: #E5E6E9;
                }
                .streamlit-container::-webkit-scrollbar-thumb {
                    background: #212121;
                    border-radius: 4px;
                }
                .streamlit-container::-webkit-scrollbar-thumb:hover {
                    background: #1b1b1b;
                }
                .streamlit-container {
                    scrollbar-width: thin;
                    scrollbar-color: #212121 #E5E6E9;
                }
            `}</style>
        </Card>
    )
}

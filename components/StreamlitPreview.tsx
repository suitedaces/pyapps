import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export function StreamlitPreview({
    url,
    isGeneratingCode,
}: {
    url: string | null
    isGeneratingCode: boolean
}) {
    if (isGeneratingCode) {
        return (
            <Card className="bg-gray-800 border-gray-700 h-full flex items-center justify-center">
                <CardContent className="text-center">
                    <span>
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                        <p className="text-gray-400">
                            Generating Streamlit app...
                        </p>
                    </span>
                </CardContent>
            </Card>
        )
    }

    if (!url) {
        return (
            <Card className="bg-gray-800 border-gray-700 h-full flex items-center justify-center">
                <CardContent className="text-center text-gray-400">
                    No Streamlit app generated yet.
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-gray-800 border-gray-700 h-full">
            <CardContent className="p-0 h-full">
                <iframe
                    src={url}
                    className="w-full h-full border-0 rounded-lg"
                />
            </CardContent>
        </Card>
    )
}

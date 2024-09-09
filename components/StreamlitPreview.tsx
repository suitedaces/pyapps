import { useEffect, useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from 'lucide-react'

export function StreamlitPreview({ chatId, isGeneratingCode }: { chatId: string, isGeneratingCode: boolean }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStreamlitUrl() {
      if (!chatId) return

      try {
        const response = await fetch('/api/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getUrl', chatId }),
        })
        if (response.ok) {
          const data = await response.json()
          if (data.url) {
            setUrl(data.url)
          }
        }
      } catch (error) {
        console.error('Error fetching Streamlit URL:', error)
      }
    }
    
    if (chatId && !isGeneratingCode) {
      fetchStreamlitUrl()
    }
  }, [chatId, isGeneratingCode])

  if (isGeneratingCode) {
    return (
      <Card className="bg-gray-800 border-gray-700 h-full flex items-center justify-center">
        <CardContent className="text-center">
          <span>
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
            <p className="text-gray-400">Generating Streamlit app...</p>
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
        <iframe src={url} className="w-full h-full border-0 rounded-lg" />
      </CardContent>
    </Card>
  )
}
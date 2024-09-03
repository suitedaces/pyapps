import { Card, CardContent } from "@/components/ui/card"

export function StreamlitPreview({ url }: { url: string | null }) {
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
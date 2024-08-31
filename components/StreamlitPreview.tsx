import { Card, CardContent } from "@/components/ui/card"

export function StreamlitPreview({ url }: { url: string | null }) {
  if (!url) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No Streamlit app generated yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0 h-[600px]">
        <iframe src={url} className="w-full h-full border-0" />
      </CardContent>
    </Card>
  )
}
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent } from "@/components/ui/card"
import { Upload } from "lucide-react"

export function FileUpload({ onUpload }: { onUpload: (content: string, fileName: string) => void }) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onabort = () => console.log('file reading was aborted')
      reader.onerror = () => console.log('file reading has failed')
      reader.onload = () => {
        const binaryStr = reader.result
        if (typeof binaryStr === 'string') {
          onUpload(binaryStr, file.name)
        }
      }
      reader.readAsText(file)
    })
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false
  })

  return (
    <Card>
      <CardContent>
        <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400">
          <input {...getInputProps()} accept=".csv" />
          {isDragActive ? (
            <p>Drop the CSV file here ...</p>
          ) : (
            <div>
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-1">Drag &apos;n&apos; drop a CSV file here, or click to select a file</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
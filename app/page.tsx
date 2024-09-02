'use client'

import { Chat } from '@/components/Chat'
import { FileUpload } from '@/components/FileUpload'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Navbar } from '@/components/NavBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeView } from '@/components/CodeView'
import { useChat } from '@/hooks/useChat'

export default function Home() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    handleFileUpload,
    csvContent,
    csvFileName,
    streamlitUrl,
    generatedCode,
    streamingMessage,
    streamingCode,
  } = useChat();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <FileUpload onUpload={handleFileUpload} />
            <Chat
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              streamingMessage={streamingMessage}
            />
          </div>
          <div>
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">App</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <StreamlitPreview url={streamlitUrl} />
              </TabsContent>
              <TabsContent value="code">
                <CodeView code={streamingCode || generatedCode} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}
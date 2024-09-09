'use client'

import { useUser } from '@auth0/nextjs-auth0/client'
import { Chat } from '@/components/Chat'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Navbar } from '@/components/NavBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeView } from '@/components/CodeView'
import { useChat } from '@/hooks/useChat'
import { redirect } from 'next/navigation'

export default function Home() {
  const { user, isLoading } = useUser()
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chatLoading,
    handleFileUpload,
    streamlitUrl,
    generatedCode,
    streamingMessage,
    streamingCodeExplanation,
    isGeneratingCode,
    chatId,
  } = useChat()

  if (isLoading) return <div>Loading...</div>

  if (!user) {
    redirect('/api/auth/login')
    return null
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <Navbar />
      <main className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-1/2 p-4 flex flex-col h-[calc(100vh-4rem)]">
          <Chat
            messages={messages}
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={chatLoading}
            streamingMessage={streamingMessage}
            streamingCodeExplanation={streamingCodeExplanation}
            handleFileUpload={handleFileUpload}
            chatId={chatId || ''}
          />
        </div>
        <div className="w-full lg:w-1/2 p-4 flex flex-col h-[calc(100vh-4rem)]">
          <Tabs defaultValue="preview" className="flex-grow flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="preview">App</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="flex-grow">
              <StreamlitPreview url={streamlitUrl} isGeneratingCode={isGeneratingCode} chatId={chatId || ''} />
            </TabsContent>
            <TabsContent value="code" className="flex-grow">
              <CodeView 
                code={generatedCode}
                isGeneratingCode={isGeneratingCode}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
"use client"

import { Chat } from '@/components/Chat'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Navbar } from '@/components/NavBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeView } from '@/components/CodeView'
import { useChat } from '@/hooks/useChat'
import { UserProvider } from '@auth0/nextjs-auth0/client'

export default function Home() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    handleFileUpload,
    streamlitUrl,
    generatedCode,
    streamingMessage,
    streamingCodeExplanation,
    isGeneratingCode,
    user,
    userError,
    userLoading,
  } = useChat();

  if (userError) return <div>Error: {userError.message}</div>
  if (userLoading) return <div>Loading...</div>

  return (
    <UserProvider>
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <Navbar />
        {user ? (
          <main className="flex-grow flex flex-col lg:flex-row overflow-hidden">
            <div className="w-full lg:w-1/2 p-4 flex flex-col h-[calc(100vh-4rem)]">
              <Chat
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                streamingMessage={streamingMessage}
                streamingCodeExplanation={streamingCodeExplanation}
                handleFileUpload={handleFileUpload}
              />
            </div>
            <div className="w-full lg:w-1/2 p-4 flex flex-col h-[calc(100vh-4rem)]">
              <Tabs defaultValue="preview" className="flex-grow flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="preview">App</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="flex-grow">
                  <StreamlitPreview url={streamlitUrl} isGeneratingCode={isGeneratingCode} />
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
        ) : (
          <div className="flex-grow flex items-center justify-center">
            <a href="/api/auth/login" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              Login to get started
            </a>
          </div>
        )}
      </div>
    </UserProvider>
  )
}
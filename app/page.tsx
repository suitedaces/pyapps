'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useEffect, useState, useCallback } from 'react'

import { Chat } from '@/components/Chat'
import { CodeView } from '@/components/CodeView'
import LoginPage from '@/components/LoginPage'
import { Navbar } from '@/components/NavBar'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useChat } from '@/hooks/useChat'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { MetaSheet } from '@/components/MetaSheet'
import Sidebar from '@/components/Sidebar'

const truncate = (str: string) => {
    const maxLength = 30; // Adjust this value as needed
    if (str.length <= maxLength) return str;
    const extension = str.slice(str.lastIndexOf('.'));
    const nameWithoutExtension = str.slice(0, str.lastIndexOf('.'));
    const truncatedName = nameWithoutExtension.slice(0, maxLength - 3 - extension.length);
    return `${truncatedName}...${extension}`;
};

export default function Home() {
    const [isRightContentVisible, setIsRightContentVisible] = useState(true)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [session, setSession] = useState<Session | null>(null)
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState('preview')

    const supabase = createClientComponentClient()
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        handleFileUpload,
        csvFileName,
        csvContent,
        streamlitUrl,
        generatedCode,
        streamingMessage,
        streamingCodeExplanation,
        isGeneratingCode,
    } = useChat(currentChatId)


    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible((prev) => !prev)
    }, [])

    const handleChatSelect = useCallback((chatId: string) => {
        setCurrentChatId(chatId)
    }, [])

    const handleNewChat = useCallback(async () => {
        try {
            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: 'New Chat' }),
            })
            if (!response.ok) {
                throw new Error('Failed to create new chat')
            }
            const data = await response.json()
            setCurrentChatId(data.id)
        } catch (error) {
            console.error('Error creating new chat:', error)
        }
    }, [])

    const handleTabChange = useCallback((value: string) => {
        setActiveTab(value)
    }, [])

    if (!session) {
        return <LoginPage />
    }

    return (
        <div className="flex flex-col min-h-screen bg-bg text-white">
            <Sidebar
                isRightContentVisible={isRightContentVisible}
                setIsRightContentVisible={setIsRightContentVisible}
                onChatSelect={handleChatSelect}
                onNewChat={handleNewChat}
                currentChatId={currentChatId}
            />
            <Navbar isRightContentVisible={isRightContentVisible} />
            <main className="flex-grow flex flex-col lg:flex-row overflow-hidden justify-center">
                <motion.div
                    className="w-full lg:w-1/2 px-4 flex flex-col h-[calc(100vh-4rem)]"
                    animate={{
                        x: isRightContentVisible ? 0 : '50%',
                    }}
                    transition={{ type: 'ease', stiffness: 300, damping: 30 }}
                >
                    {currentChatId ? (
                        <Chat
                            messages={messages}
                            input={input}
                            handleInputChange={handleInputChange}
                            handleSubmit={handleSubmit}
                            isLoading={isLoading}
                            streamingMessage={streamingMessage}
                            streamingCodeExplanation={streamingCodeExplanation}
                            handleFileUpload={handleFileUpload}
                            onChatSelect={handleChatSelect}
                        />
                    ) : (
                        <div className="flex items-center text-black justify-center h-full">
                            <p>
                                Select a chat or create a new one to get
                                started!
                            </p>
                        </div>
                    )}
                </motion.div>

                <motion.div
                    initial={{ x: '100%' }}
                    animate={{
                        x: isRightContentVisible ? 0 : '100%',
                    }}
                    transition={{ type: 'ease', stiffness: 300, damping: 30 }}
                    className="w-full lg:w-1/2 p-4 flex flex-col border-2 border-border rounded-3xl h-[calc(100vh-4rem)]"
                >
                    <Tabs
                        defaultValue='file'
                        // value={activeTab}
                        // onValueChange={handleTabChange}
                        className="flex-grow flex flex-col h-full"
                    >
                        <TabsList
                            className={`grid w-full ${csvFileName ? 'grid-cols-3' : 'grid-cols-2'} mb-4`}
                        >
                            {csvFileName && (
                                <TabsTrigger value="file">
                                    {truncate(csvFileName)}
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="preview">App</TabsTrigger>
                            <TabsTrigger value="code">Code</TabsTrigger>
                        </TabsList>
                        {csvFileName && (
                            <TabsContent value="file" className="flex-grow">
                                <MetaSheet
                                    csvContent={csvContent}
                                />
                            </TabsContent>
                        )}
                        <TabsContent value="preview" className="flex-grow">
                            <StreamlitPreview
                                url={streamlitUrl}
                                isGeneratingCode={isGeneratingCode}
                            />
                        </TabsContent>
                        <TabsContent value="code" className="flex-grow">
                            <CodeView
                                code={generatedCode}
                                isGeneratingCode={isGeneratingCode}
                            />
                        </TabsContent>
                    </Tabs>
                </motion.div>

                <Button
                    onClick={toggleRightContent}
                    className="absolute top-2 right-4 z-10 bg-main text-text"
                    size="icon"
                >
                    {isRightContentVisible ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </main>
        </div>
    )
}

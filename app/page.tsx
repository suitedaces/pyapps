'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import React, { useEffect, useState, useCallback, useRef } from 'react'

import { Chat } from '@/components/Chat'
import { CodeView } from '@/components/CodeView'
import LoginPage from '@/components/LoginPage'
import { Navbar } from '@/components/NavBar'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useChat } from '@/hooks/useChat'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"

import { MetaSheet } from '@/components/MetaSheet'
import { SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from '@/components/Sidebar'

const truncate = (str: string) => {
    const maxLength = 30; // Adjust this value as needed
    if (str.length <= maxLength) return str;
    const extension = str.slice(str.lastIndexOf('.'));
    const nameWithoutExtension = str.slice(0, str.lastIndexOf('.'));
    const truncatedName = nameWithoutExtension.slice(0, maxLength - 3 - extension.length);
    return `${truncatedName}...${extension}`;
};

const CustomHandle = ({ ...props }) => (
    <ResizableHandle {...props} withHandle className="relative">
        <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
            <div className="h-8 w-1 rounded-full bg-black" />
        </div>
    </ResizableHandle>
)

export default function Home() {
    const [isRightContentVisible, setIsRightContentVisible] = useState(true)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [session, setSession] = useState<Session | null>(null)
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState('preview')
    const resizableGroupRef = useRef<any>(null)

    const supabase = createClientComponentClient()
    const {
        messages,
        input,
        isLoading,
        handleInputChange,
        handleSubmit,
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

    const handleInputChangeWrapper = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        handleInputChange(e as React.ChangeEvent<HTMLInputElement>);
    }, [handleInputChange]);

    useEffect(() => {
        if (session && !currentChatId) {
            handleNewChat();
        }
    }, [session, handleNewChat, currentChatId]);

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible((prev) => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => {
                resizableGroupRef.current.resetLayout()
            }, 0)
        }
    }, [])

    if (!session) {
        return <LoginPage />
    }

    return (
        <SidebarProvider>
            <AppSidebar
                onChatSelect={handleChatSelect}
                onNewChat={handleNewChat}
            />
            <div className="flex flex-col min-h-screen w-full bg-bg text-white overflow-x-hidden">
                <main className="flex-grow flex px-2 flex-col mt-9 lg:flex-row overflow-hidden justify-center relative">
                    <ResizablePanelGroup direction="horizontal" ref={resizableGroupRef}>
                        <ResizablePanel defaultSize={65} minSize={45}>
                            <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
                                <Chat
                                    messages={messages}
                                    input={input}
                                    handleInputChange={handleInputChangeWrapper}
                                    handleSubmit={handleSubmit}
                                    isLoading={isLoading}
                                    streamingMessage={streamingMessage}
                                    streamingCodeExplanation={streamingCodeExplanation}
                                    handleFileUpload={handleFileUpload}
                                    currentChatId={currentChatId}
                                    onChatSelect={handleChatSelect}
                                />
                            </div>
                        </ResizablePanel>

                        {isRightContentVisible && <CustomHandle />}

                        {isRightContentVisible && (
                            <ResizablePanel minSize={30} className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden border-2 border-border rounded-3xl h-[calc(100vh-4rem)]">
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
                            </ResizablePanel>
                        )}
                    </ResizablePanelGroup>

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
        </SidebarProvider>
    )
}

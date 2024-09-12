"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { Chat } from '@/components/Chat'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Navbar } from '@/components/NavBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeView } from '@/components/CodeView'
import { useChat } from '@/hooks/useChat'
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from '@/components/ui/sheet'
import { Button } from "@/components/ui/button"
import { ScrollArea } from '@/components/ui/scroll-area'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import SVG from 'react-inlinesvg'
import { Children } from 'react'
import { MetaSheet } from '@/components/MetaSheet'
import Sidebar from '@/components/Sidebar'

export default function Home({ children }) {
    const [isRightContentVisible, setIsRightContentVisible] = useState(true)
    const [isAtBottom, setIsAtBottom] = useState(true);

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
    } = useChat();

    const toggleRightContent = () => {
        setIsRightContentVisible(!isRightContentVisible)
    }

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        setIsAtBottom(scrollHeight - scrollTop === clientHeight);
    };

    const sheetTrigger = (
        <SheetTrigger asChild>
            <Button className='bg-main text-text p-3 h-11 mr-4'>
                <SVG src="/icons/code.svg" className="text-text" width={30} height={30} title={'code'} />
            </Button>
        </SheetTrigger>
    );

    const truncateFileName = (fileName: string, maxLength: number) => {
        if (fileName.length <= maxLength) return fileName;
        const extension = fileName.split('.').pop();
        const nameWithoutExtension = fileName.slice(0, fileName.lastIndexOf('.'));
        const truncatedName = nameWithoutExtension.slice(0, maxLength - extension.length - 3);
        return `${truncatedName}...${extension}`;
    };

    return (
        // <Sheet>
        <div className="flex flex-col min-h-screen  bg-bg text-white">
            {/* <Navbar sheetTrigger={sheetTrigger} /> */}
            <Sidebar isRightContentVisible={isRightContentVisible} setIsRightContentVisible={setIsRightContentVisible} />
            <Navbar isRightContentVisible={isRightContentVisible} />
            <main className="flex-grow flex flex-col lg:flex-row overflow-hidden justify-center">
                <motion.div
                    className="w-full lg:w-1/2 px-4 flex flex-col h-[calc(100vh-4rem)]"
                    animate={{
                        x: isRightContentVisible ? 0 : '50%',
                    }}
                    transition={{ type: "ease", stiffness: 300, damping: 30 }}
                >
                    {/* <div className="w-full lg:w-1/2 px-4 flex flex-col h-[calc(100vh-4rem)]"> */}
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
                    {/* </div> */}
                </motion.div>

                {/* Right Content */}

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{
                            x: isRightContentVisible ? 0 : '100%',
                        }}
                        transition={{ type: "ease", stiffness: 300, damping: 30 }}
                        className="w-full lg:w-1/2 p-4 flex flex-col border-2 border-border rounded-3xl h-[calc(100vh-4rem)]">
                        <Tabs defaultValue="preview" className="flex-grow flex flex-col h-full">
                            <TabsList className={`grid w-full ${csvFileName ? 'grid-cols-3' : 'grid-cols-2'} mb-4`}>
                                {csvFileName && (
                                    <TabsTrigger value="file">
                                        {truncateFileName(csvFileName, 20)}
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="preview">App</TabsTrigger>
                                <TabsTrigger value="code">Code</TabsTrigger>
                            </TabsList>
                            {csvFileName && (
                                <TabsContent value="file" className="flex-grow">
                                    <MetaSheet csvContent={csvContent} />
                                </TabsContent>
                            )}
                            <TabsContent value="preview" className="flex-grow">
                                <StreamlitPreview url={streamlitUrl} isGeneratingCode={isGeneratingCode} />
                            </TabsContent>
                            <TabsContent value="code" className="flex-grow">
                                <CodeView
                                    code={generatedCode}
                                    isGeneratingCode={isGeneratingCode}
                                >
                                    {children}
                                </CodeView>
                            </TabsContent>
                        </Tabs>
                    </motion.div>

                <Button
                    onClick={toggleRightContent}
                    className="absolute top-2 right-4 z-10 bg-main text-text"
                    size="icon"
                >
                    {isRightContentVisible ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </main>
        </div>
    )
}

{/* <SheetContent>
                <Tabs defaultValue="preview" className="flex-grow flex flex-col h-full">
                    <SheetHeader>
                        <TabsList className="mt-10 grid w-full grid-cols-4 mb-4">
                            <TabsTrigger value="meta">MetaSheet</TabsTrigger>
                            <TabsTrigger value="spreadsheet">Spreadsheet</TabsTrigger>
                            <TabsTrigger value="preview">App</TabsTrigger>
                            <TabsTrigger value="code">Code</TabsTrigger>
                        </TabsList>
                    </SheetHeader>
                    <TabsContent value="meta" className="flex-grow">
                        MetaSheet Content
                    </TabsContent>
                    <TabsContent value="spreadsheet" className="flex-grow">
                        Spreadsheet Content
                    </TabsContent>
                    <TabsContent value="preview" className="flex-grow">
                        <StreamlitPreview url={streamlitUrl} isGeneratingCode={isGeneratingCode} />
                    </TabsContent>
                    <TabsContent value="code" className="flex-grow">
                        <CodeView
                            code={generatedCode}
                            isGeneratingCode={isGeneratingCode}
                        >
                            <ScrollArea>
                                {children}
                            </ScrollArea>

                        </CodeView>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet> */}

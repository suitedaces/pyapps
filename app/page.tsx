"use client"

import { Chat } from '@/components/Chat'
import { StreamlitPreview } from '@/components/StreamlitPreview'
import { Navbar } from '@/components/NavBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeView } from '@/components/CodeView'
import { useChat } from '@/hooks/useChat'
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from '@/components/ui/sheet'
import { Button } from "@/components/ui/button"
import { ScrollArea } from '@/components/ui/scroll-area'

import SVG from 'react-inlinesvg'
import { Children } from 'react'
import { Metadata } from '@/components/Metadata'
import { Spreadsheet } from '@/components/Spreadsheet'
import Sidebar from '@/components/Sidebar'

export default function Home({ children }) {
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        handleFileUpload,
        csvFileName,
        streamlitUrl,
        generatedCode,
        streamingMessage,
        streamingCodeExplanation,
        isGeneratingCode,
    } = useChat();

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
            <Sidebar />
            <Navbar />
            <main className="flex-grow flex flex-col lg:flex-row overflow-hidden justify-center">
                <div className="w-full lg:w-1/2 px-4 flex flex-col h-[calc(100vh-4rem)]">
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
                <div className="w-full lg:w-1/2 p-4 flex flex-col border-2 border-border rounded-3xl h-[calc(100vh-4rem)]">
                    <Tabs defaultValue="preview" className="flex-grow flex flex-col h-full">
                        <SheetHeader>
                            <TabsList className={`grid w-full ${csvFileName ? 'grid-cols-3' : 'grid-cols-2'} mb-4`}>
                                {csvFileName && (
                                    <TabsTrigger value="file">
                                        {truncateFileName(csvFileName, 20)}
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="preview">App</TabsTrigger>
                                <TabsTrigger value="code">Code</TabsTrigger>
                            </TabsList>
                        </SheetHeader>
                        {csvFileName && (
                            <TabsContent value="file" className="flex-grow">
                                <Metadata />
                                <Spreadsheet />
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
                                <ScrollArea>
                                    {children}
                                </ScrollArea>

                            </CodeView>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    )
}

{/* <SheetContent>
                <Tabs defaultValue="preview" className="flex-grow flex flex-col h-full">
                    <SheetHeader>
                        <TabsList className="mt-10 grid w-full grid-cols-4 mb-4">
                            <TabsTrigger value="meta">Metadata</TabsTrigger>
                            <TabsTrigger value="spreadsheet">Spreadsheet</TabsTrigger>
                            <TabsTrigger value="preview">App</TabsTrigger>
                            <TabsTrigger value="code">Code</TabsTrigger>
                        </TabsList>
                    </SheetHeader>
                    <TabsContent value="meta" className="flex-grow">
                        Metadata Content
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

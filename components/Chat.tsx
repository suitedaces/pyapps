'use client'

import React, { useEffect, useCallback, useRef, useState, ChangeEvent, FormEvent } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ClientMessage } from '@/lib/types'
import { Code, FileIcon, Loader2, Paperclip, Send, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { CircularProgress } from '@/components/CircularProgress'
import Spreadsheet from './Spreadsheet'
import { analyzeCSV, CSVAnalysis } from '@/lib/csvAnalyzer'

interface CodeProps {
    node?: any;
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
}

interface ChatProps {
    messages: ClientMessage[];
    input: string;
    handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
    isLoading: boolean;
    streamingMessage: string;
    streamingCodeExplanation: string;
    handleFileUpload: (content: string, fileName: string) => void;
    onChatSelect: (chatId: string) => void;
}

interface Chat {
    id: string;
    name: string;
}

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
}


export function Chat({
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: isLoadingProp,
    streamingMessage,
    streamingCodeExplanation,
    handleFileUpload,
}: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isAtBottom, setIsAtBottom] = useState<boolean>(true)
    const [file, setFile] = useState<File | null>(null)
    const [isLoadingInternal, setIsLoadingInternal] = useState<boolean>(false)
    const [isInputDisabled, setIsInputDisabled] = useState<boolean>(false)
    const [uploadProgress, setUploadProgress] = useState<number>(0)
    const [isUploading, setIsUploading] = useState<boolean>(false)
    const [csvAnalysis, setCsvAnalysis] = useState<CSVAnalysis | null>(null)
    const [showSpreadsheet, setShowSpreadsheet] = useState(false)
    const [fileContent, setFileContent] = useState<string | null>(null)
    const [fullData, setFullData] = useState<string[][] | null>(null)


    const isLoading = isLoadingProp || isLoadingInternal

    useEffect(() => {
        if (isAtBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, streamingMessage, streamingCodeExplanation, isAtBottom])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
        setIsAtBottom(scrollHeight - scrollTop === clientHeight)
    }

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (selectedFile && selectedFile.name.endsWith('.csv')) {
            setFile(selectedFile)
            setIsInputDisabled(true)
            setUploadProgress(0)
            readFile(selectedFile)
        } else {
            alert('Please select a CSV file.')
        }
    }

    const readFile = (file: File) => {
        setIsUploading(true)
        const reader = new FileReader()
        reader.onload = async (e: ProgressEvent<FileReader>) => {
            const content = e.target?.result as string
            setFileContent(content)
            setIsUploading(false)
            setUploadProgress(100)
            const rows = content.split('\n').map(row => row.split(','));
            setFullData(rows);
        }
        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100)
                setUploadProgress(progress)
            }
        }
        reader.readAsText(file)
    }

    const removeFile = useCallback(() => {
        setFile(null)
        setFileContent(null)
        setIsInputDisabled(false)
        setUploadProgress(0)
        setIsUploading(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoadingInternal(true)

        try {
            if (file && fileContent) {
                const analysis = await analyzeCSV(fileContent)
                setCsvAnalysis(analysis)
                setShowSpreadsheet(true)
                removeFile()
                await handleFileUpload(fileContent, file.name)
            }
            await handleSubmit(e)
        } catch (error) {
            console.error('Error submitting form:', error)
        } finally {
            setIsLoadingInternal(false)
        }
    }


    const renderMessage = (content: string) => (
        <ReactMarkdown
            components={{
                code({ node, inline, className, children, ...props }: CodeProps) {
                    const match = /language-(\w+)/.exec(className || '')
                    const lang = match && match[1] ? match[1] : ''
                    const codeString = String(children).replace(/\n$/, '')

                    if (inline) {
                        return (
                            <code
                                className="px-1 py-0.5 rounded-base bg-bg dark:bg-darkBg text-text dark:text-darkText text-sm font-mono"
                                {...props}
                            >
                                {codeString}
                            </code>
                        )
                    }

                    return (
                        <div className="rounded-base overflow-hidden bg-dark dark:bg-darkBg my-4 border-border border-2 dark:shadow-dark w-full">
                            <div className="flex items-center justify-between px-4 py-2 bg-bg">
                                <div className="flex items-center">
                                    <Code className="w-5 h-5 mr-2 text-text dark:text-darkText" />
                                    <span className="text-sm font-medium text-text dark:text-darkText">
                                        {lang.toUpperCase() || 'Code'}
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <SyntaxHighlighter
                                    style={tomorrow}
                                    language={lang || 'javascript'}
                                    PreTag="div"
                                    customStyle={{
                                        margin: 0,
                                        padding: '1rem',
                                    }}
                                    {...props}
                                >
                                    {codeString}
                                </SyntaxHighlighter>
                            </div>
                        </div>
                    )
                },
                p: ({ children }) => (
                    <p className="mb-2 break-words">{children}</p>
                ),
                h1: ({ children }) => (
                    <h1 className="text-2xl font-bold mb-3">{children}</h1>
                ),
                h2: ({ children }) => (
                    <h2 className="text-xl font-bold mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                    <h3 className="text-lg font-bold mb-2">{children}</h3>
                ),
                ul: ({ children }) => (
                    <ul className="list-disc list-outside pl-6 mb-2">
                        {children}
                    </ul>
                ),
                ol: ({ children }) => (
                    <ol className="list-decimal list-outside pl-6 mb-2">
                        {children}
                    </ol>
                ),
                li: ({ children }) => (
                    <li className="mb-1">
                        {React.Children.map(children, (child) =>
                            typeof child === 'string' ? (
                                <span>{child}</span>
                            ) : (
                                child
                            )
                        )}
                    </li>
                ),
                blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-main pl-4 italic mb-2">
                        {children}
                    </blockquote>
                ),
            }}
            className="prose prose-invert max-w-none"
        >
            {content}
        </ReactMarkdown>
    )

    return (
        <div className="flex flex-col h-full dark:border-darkBorder rounded-3xl border-2 border-border bg-darkText dark:bg-darkBg text-text dark:text-darkText">
            <ScrollArea
                className="flex-grow p-4 space-y-4"
                onScroll={handleScroll}
            >
                {showSpreadsheet && csvAnalysis && (
                    <div className="relative w-full mb-10 flex justify-end">
                        <div className='w-[80%]'>
                            <Spreadsheet
                                analysis={csvAnalysis}
                                onClose={() => setShowSpreadsheet(false)}
                                fullData={fullData}
                            />
                        </div>
                    </div>
                )}
                {messages.map((message, index) => (
                    <React.Fragment key={index}>
                        {message.role === 'user' && (
                            <div className="flex justify-end mb-4">
                                <div className="flex flex-row-reverse items-start max-w-[80%]">
                                    <Avatar className="w-8 h-8 bg-blue border-2 border-border flex-shrink-0">
                                        <AvatarFallback>U</AvatarFallback>
                                    </Avatar>
                                    <div className="mx-2 p-4 rounded-base bg-bg text-text dark:text-darkText border-2 border-border break-words overflow-hidden dark:shadow-dark transition-all duration-300 ease-in-out">
                                        {renderMessage(message.content)}
                                    </div>
                                </div>
                            </div>
                        )}
                        {message.role === 'assistant' && (
                            <div className="flex justify-start mb-4">
                                <div className="flex flex-row items-start max-w-[80%]">
                                    <Avatar className="w-8 h-8 bg-main border-2 border-border flex-shrink-0">
                                        <AvatarFallback>G</AvatarFallback>
                                    </Avatar>
                                    <div className="mx-2 p-4 rounded-base bg-main text-text dark:text-darkText border-2 border-border break-words overflow-hidden dark:shadow-dark transition-all duration-300 ease-in-out">
                                        {renderMessage(message.content)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                ))}
                {streamingMessage && (
                    <div className="flex justify-start mb-4">
                        <div className="flex flex-row items-start max-w-[80%]">
                            <Avatar className="w-8 h-8 bg-main border-2 border-border flex-shrink-0">
                                <AvatarFallback>G</AvatarFallback>
                            </Avatar>
                            <div className="mx-2 p-4 rounded-base bg-main text-text dark:text-darkText border-2 border-border break-words overflow-hidden dark:shadow-dark transition-all duration-300 ease-in-out">
                                {renderMessage(streamingMessage)}
                            </div>
                        </div>
                    </div>
                )}
                {streamingCodeExplanation && (
                    <div className="flex justify-start mb-4">
                        <div className="flex flex-row items-start max-w-[80%]">
                            <Avatar className="w-8 bg-main h-8 flex-shrink-0">
                                <AvatarFallback>G</AvatarFallback>
                            </Avatar>
                            <div className="mx-2 p-4 rounded-base bg-main text-text dark:text-darkText break-words overflow-hidden shadow-light dark:shadow-dark transition-all duration-500 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none">
                                {renderMessage(streamingCodeExplanation)}
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </ScrollArea>
            {!isAtBottom && (
                <Button
                    onClick={() =>
                        messagesEndRef.current?.scrollIntoView({
                            behavior: 'smooth',
                        })
                    }
                    className="absolute bottom-20 right-8 bg-main hover:bg-mainAccent text-text dark:text-darkText rounded-full p-2 shadow-light dark:shadow-dark transition-all duration-300 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
                >
                    ↓
                </Button>
            )}
            <form
                onSubmit={handleFormSubmit}
                className="p-4 dark:border-darkBorder"
            >
                <div className="flex space-x-2">
                    <div className="relative flex-grow">
                        <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden ${file ? 'max-h-20' : 'max-h-0'
                                }`}
                        >
                            {file && (
                                <div className="px-3 flex justify-start mb-2">
                                    <div className="inline-flex items-center bg-white border-black border-2 rounded-xl py-1 px-3 max-w-full">
                                        <FileIcon
                                            size={16}
                                            className="text-blue-400 mr-2 flex-shrink-0"
                                        />
                                        <div className="flex flex-col min-w-0 mr-2">
                                            <span className="text-black text-sm truncate max-w-[200px]">
                                                {file.name}
                                            </span>
                                            <span className="text-gray-700 text-xs">
                                                {formatFileSize(file.size)}
                                            </span>
                                        </div>
                                        {isUploading ? (
                                            <CircularProgress
                                                size={24}
                                                percentage={uploadProgress}
                                                color="text-blue-400"
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={removeFile}
                                                className="text-gray-400 hover:text-black p-1 ml-1"
                                                aria-label="Remove file"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <Input
                            value={input}
                            onChange={handleInputChange}
                            placeholder={isInputDisabled ? "File attached. Remove file to type a message." : "Type your message..."}
                            className="relative flex w-full h-20 rounded-full text-text dark:text-darkText font-base selection:bg-main selection:text-text dark:selection:text-darkText dark:border-darkBorder bg-bg dark:bg-darkBg px-3 pl-14 py-2 text-sm ring-offset-bg dark:ring-offset-darkBg placeholder:text-text/50 dark:placeholder:text-darkText/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text dark:focus-visible:ring-darkText focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-2 border-border shadow-light"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute left-5 bottom-5 transform -translate-y-1/2 text-text dark:text-darkText hover:text-main transition-colors duration-300 ease-in-out"
                            disabled={isUploading || file !== null}
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isUploading}
                        />
                        <Button
                            type="submit"
                            variant={'noShadow'}
                            disabled={isLoading || isUploading || (!input.trim() && !file)}
                            className="absolute rounded-full right-5 bottom-5 bg-blue hover:bg-main text-text dark:text-darkText transition-all duration-300 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY"
                        >
                            {isLoading || isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}

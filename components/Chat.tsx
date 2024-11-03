'use client'

import { CircularProgress } from '@/components/CircularProgress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AnimatePresence, motion } from 'framer-motion'
import { ClientMessage } from '@/lib/types'
import { Code, FileIcon, Loader2, Paperclip, Send, X } from 'lucide-react'
import React, { ChangeEvent, FormEvent, useEffect, useRef, useState, HTMLAttributes } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'

import { analyzeCSV, CSVAnalysis } from '@/lib/csvAnalyzer'
import Spreadsheet from './Spreadsheet'

interface CodeProps {
    node?: any
    inline?: boolean
    className?: string
    children?: React.ReactNode
}

interface MarkdownComponentProps {
    children?: React.ReactNode
}

interface ChatProps {
    messages: ClientMessage[]
    input: string
    handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    handleSubmit: (e: FormEvent<HTMLFormElement>) => void
    isLoading: boolean
    streamingMessage: string
    handleFileUpload: (content: string, fileName: string) => void
    currentChatId: string | null
    onChatSelect: (chatId: string) => void
}

export function Chat({
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    streamingMessage,
    handleFileUpload,
    currentChatId
}: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [isInputDisabled, setIsInputDisabled] = useState<boolean>(false)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [isInitial, setIsInitial] = useState(true)
    const [csvAnalysis, setCsvAnalysis] = useState<CSVAnalysis | null>(null)
    const [showSpreadsheet, setShowSpreadsheet] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [fileContent, setFileContent] = useState<string | null>(null)
    const [fullData, setFullData] = useState<string[][] | null>(null)

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streamingMessage])

    // Add scroll listener to track bottom position
    useEffect(() => {
        const handleScroll = () => {
            if (messagesEndRef.current) {
                const { scrollHeight, scrollTop, clientHeight } = messagesEndRef.current
                setIsAtBottom(Math.abs(scrollHeight - scrollTop - clientHeight) < 10)
            }
        }
        const messagesContainer = messagesEndRef.current?.parentElement
        messagesContainer?.addEventListener('scroll', handleScroll)
        return () => messagesContainer?.removeEventListener('scroll', handleScroll)
    }, [])

    // Set isInitial to false after mount
    useEffect(() => {
        setIsInitial(false)
    }, [])

    // File upload handlers
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

    const handleTextareaChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
        handleInputChange(e)
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
        setIsAtBottom(scrollHeight - scrollTop === clientHeight)
    }

    const removeFile = () => {
        setFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
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
            const rows = content.split('\n').map((row) => row.split(','))
            setFullData(rows)
        }
        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100)
                setUploadProgress(progress)
            }
        }
        reader.readAsText(file)
    }

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (file) {
            setIsUploading(true)
            try {
                const reader = new FileReader()
                reader.onload = async (event) => {
                    const content = event.target?.result as string
                    await handleFileUpload(content, file.name)
                    setFile(null)
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                    }
                }
                reader.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const progress = (event.loaded / event.total) * 100
                        setUploadProgress(progress)
                    }
                }
                reader.readAsText(file)
                setShowSpreadsheet(true)
            } catch (error) {
                console.error('Error uploading file:', error)
            } finally {
                setIsUploading(false)
                setUploadProgress(0)
            }
        } else {
            handleSubmit(e)
        }
    }

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' bytes'
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
        else return (bytes / 1048576).toFixed(1) + ' MB'
    }

    const markdownComponents: Partial<Components> = {
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
        p: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
            <p className="mb-2 break-words" {...props}>{children}</p>
        ),
        h1: ({ children }: MarkdownComponentProps) => (
            <h1 className="text-2xl font-bold mb-3">{children}</h1>
        ),
        h2: ({ children }: MarkdownComponentProps) => (
            <h2 className="text-xl font-bold mb-2">{children}</h2>
        ),
        h3: ({ children }: MarkdownComponentProps) => (
            <h3 className="text-lg font-bold mb-2">{children}</h3>
        ),
        ul: ({ children }: MarkdownComponentProps) => (
            <ul className="list-disc list-outside pl-6 mb-2">{children}</ul>
        ),
        ol: ({ children }: MarkdownComponentProps) => (
            <ol className="list-decimal list-outside pl-6 mb-2">{children}</ol>
        ),
        li: ({ children }: MarkdownComponentProps) => (
            <li className="mb-1">
                {React.Children.map(children, (child) =>
                    typeof child === 'string' ? <span>{child}</span> : child
                )}
            </li>
        ),
        blockquote: ({ children, ...props }: any) => (
            <blockquote className="border-l-4 border-main pl-4 italic mb-2" {...props}>
                {children}
            </blockquote>
        ),
    }

    return (
        <div className="flex flex-col h-full relative dark:border-darkBorder border-2 border-border bg-white dark:bg-darkBg text-text dark:text-darkText">
            {isInitial && (
                <div className="w-full h-full absolute">
                    <div className="relative w-full h-full">
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="text-center w-full absolute top-[40%] m-auto pb-4"
                            >
                                <motion.h1
                                    className="text-4xl font-bold tracking-tight mb-1"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    What data can I help you analyze?
                                </motion.h1>
                                <motion.p
                                    className="text-muted-foreground mt-4 text-sm"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    analyse and generate dashboard apps,
                                    spreadsheets and more...
                                </motion.p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            )}
            <ScrollArea
                className="flex-grow p-4 space-y-4 w-full h-full max-w-[800px] m-auto"
                onScroll={handleScroll}
            >
                {showSpreadsheet && csvAnalysis && (
                    <div className="relative w-full mb-10 flex justify-end">
                        <div className="w-[80%]">
                            <Spreadsheet
                                analysis={csvAnalysis}
                                onClose={() => setShowSpreadsheet(false)}
                                fullData={fullData}
                            />
                        </div>
                    </div>
                )}
                <div className="flex flex-col gap-4 p-4">
                    <AnimatePresence initial={false}>
                        {messages.map((message) => (
                            <React.Fragment key={message.id}>
                                {message.role === 'user' && (
                                    <div className="flex justify-end mb-4">
                                        <div className="flex flex-row-reverse items-start max-w-[80%]">
                                            <Avatar className="w-8 h-8 bg-blue border-2 border-border flex-shrink-0">
                                                <AvatarFallback>U</AvatarFallback>
                                            </Avatar>
                                            <div className="mx-2 p-4 rounded-base bg-bg text-text dark:text-darkText border-2 border-border break-words overflow-hidden dark:shadow-dark transition-all duration-300 ease-in-out">
                                                <ReactMarkdown components={markdownComponents}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {message.role === 'assistant' && (
                                    <div className="flex justify-start mb-4 w-full">
                                        <div className="flex flex-row items-start">
                                            <Avatar className="w-8 h-8 bg-main border-2 border-border flex-shrink-0">
                                                <AvatarFallback>G</AvatarFallback>
                                            </Avatar>
                                            <div className="mx-2 p-4 text-text dark:text-darkText break-words overflow-hidden dark:shadow-dark transition-all duration-300 ease-in-out">
                                                <ReactMarkdown components={markdownComponents}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                        {streamingMessage && (
                            <div className="flex justify-start mb-4">
                                <div className="flex flex-row items-start">
                                    <Avatar className="w-8 h-8 bg-main border-2 border-border flex-shrink-0">
                                        <AvatarFallback>G</AvatarFallback>
                                    </Avatar>
                                    <div className="mx-2 px-4 text-text dark:text-darkText break-words overflow-hidden dark:shadow-dark transition-all duration-300 ease-in-out">
                                        <ReactMarkdown components={markdownComponents}>
                                            {streamingMessage}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>
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
            <motion.form
                onSubmit={handleFormSubmit}
                className="p-4 dark:border-darkBorder m-auto w-full max-w-[800px]"
                initial={false}
                animate={{
                    y: isInitial ? '-30vh' : 0,
                }}
                transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 20,
                }}
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
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleTextareaChange}
                            placeholder={
                                file
                                    ? 'File attached. Remove file to type a message.'
                                    : 'Type your message...'
                            }
                            className="relative flex w-full min-h-[80px] max-h-[200px] rounded-3xl text-text dark:text-darkText font-base selection:bg-main selection:text-text dark:selection:text-darkText dark:border-darkBorder bg-bg dark:bg-darkBg px-3 pl-14 pt-6 py-3 pr-16 text-sm ring-offset-bg dark:ring-offset-darkBg placeholder:text-text/50 dark:placeholder:text-darkText/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text dark:focus-visible:ring-darkText focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-2 border-border shadow-light resize-none overflow-hidden"
                            disabled={!!file}
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
                            size={'boxy'}
                            disabled={
                                isLoading ||
                                isUploading ||
                                (!input.trim() && !file)
                            }
                            className="absolute top rounded-lg right-5 bottom-5 bg-blue hover:bg-main text-text dark:text-darkText transition-all duration-300 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY"
                        >
                            {isLoading || isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </motion.form>
        </div>
    )
}

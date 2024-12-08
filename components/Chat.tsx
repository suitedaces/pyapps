'use client'

import { useEffect, useRef, useState } from 'react'
import { Message } from 'ai'
import Chatbar from '@/components/core/chatbar'
import { Message as AIMessage } from '@/components/core/message'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { XCircle } from 'lucide-react'

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

interface ChatProps {
    messages: Message[]
    isLoading: boolean
    input: string
    onInputChange: (value: string) => void
    onSubmit: (e: React.FormEvent, message: string, file?: File) => Promise<void>
    fileUploadState: FileUploadState
    onFileUpload: (file: File) => void
    errorState: Error | null
    onErrorDismiss: () => void
    onChatFinish: () => void
    onUpdateStreamlit: (code: string) => void
    onCodeClick: (code: string) => void
    isInChatPage: boolean
}

export function Chat({
    messages = [],
    isLoading = false,
    input = '',
    onInputChange,
    onSubmit,
    fileUploadState = { isUploading: false, progress: 0, error: null },
    onFileUpload,
    errorState = null,
    onErrorDismiss,
    onChatFinish,
    onUpdateStreamlit,
    onCodeClick,
    isInChatPage = false,
}: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Handle submission
    const handleSubmit = async (e: React.FormEvent, message: string, file?: File) => {
        e.preventDefault()
        if (!message.trim() && !file) return

        try {
            // Pass the event and message to parent's onSubmit
            await onSubmit(e, message, file)
            onChatFinish?.()
        } catch (error) {
            console.error('Error submitting message:', error)
        }
    }

    // Handle code click with Streamlit update
    const handleCodeClick = (code: string) => {
        onCodeClick?.(code)
        onUpdateStreamlit?.(code)
    }

    // Auto-scroll when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    return (
        <div className="flex flex-col relative z-20 text-black h-[calc(100vh-7rem)] overflow-hidden">
            {/* Error displays */}
            {errorState && (
                <Alert 
                    variant="destructive" 
                    className="mb-4 absolute top-0 left-0 right-0 z-50"
                    onClick={onErrorDismiss}
                >
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{errorState.message}</AlertDescription>
                </Alert>
            )}

            {fileUploadState.error && (
                <Alert 
                    variant="destructive" 
                    className="mb-4 absolute top-0 left-0 right-0 z-50"
                >
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{fileUploadState.error}</AlertDescription>
                </Alert>
            )}

            {/* Messages */}
            <ScrollArea className="h-full p-4 space-y-4 w-full max-w-[800px] m-auto pb-6">
                {Array.isArray(messages) && messages.map((message, index) => (
                    <AIMessage
                        key={message.id}
                        {...message}
                        isLastMessage={index === messages.length - 1}
                        isLoading={isLoading && index === messages.length - 1}
                        onCodeClick={handleCodeClick}
                    />
                ))}
                <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Chat input */}
            <Chatbar
                value={input}
                onChange={onInputChange}
                onSubmit={handleSubmit}
                isLoading={isLoading || fileUploadState.isUploading}
                onFileUpload={onFileUpload}
                fileUploadState={fileUploadState}
                isInChatPage={isInChatPage}
            />
        </div>
    )
}
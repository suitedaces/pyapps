'use client'

import Chatbar from '@/components/core/chatbar'
import { Message as AIMessage } from '@/components/core/message'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEffect, useRef } from 'react'
import { Message } from 'ai'

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
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    return (
        <div className="flex flex-col relative z-20 text-black h-[calc(100vh-7rem)] overflow-hidden">
            <ScrollArea className="h-full p-4 space-y-4 w-full max-w-[800px] m-auto pb-6">
                {Array.isArray(messages) && messages.map((message, index) => (
                    <AIMessage
                        key={message.id}
                        {...message}
                        isLastMessage={index === messages.length - 1}
                        isLoading={isLoading && index === messages.length - 1}
                        onCodeClick={onCodeClick}
                    />
                ))}
                <div ref={messagesEndRef} />
            </ScrollArea>

            <Chatbar
                value={input}
                onChange={onInputChange}
                onSubmit={onSubmit}
                isLoading={isLoading}
                onFileUpload={onFileUpload}
                fileUploadState={fileUploadState}
                isInChatPage={isInChatPage}
            />
        </div>
    )
}
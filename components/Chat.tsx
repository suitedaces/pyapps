'use client'

import Chatbar from '@/components/core/chatbar'
import { Message as AIMessage } from '@/components/core/message'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Message } from 'ai'
import { XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import React from 'react'
import { MessageData } from '@/components/core/message'
import { useFileStore } from '@/lib/stores/file-store'
import { metadata } from '../app/layout';

interface ChatProps {
    messages: Message[]
    isLoading: boolean
    input: string
    onInputChange: (value: string) => void
    onSubmit: (
        e: React.FormEvent,
        message: string,
        file?: File,
        fileId?: string
    ) => Promise<void>
    errorState: Error | null
    onErrorDismiss: () => void
    onChatFinish: () => void
    onUpdateStreamlit: (code: string) => void
    onCodeClick: (code: string) => void
    isInChatPage: boolean
    onTogglePanel: (panel: string) => void
}

function Chat({
    messages = [],
    isLoading = false,
    input = '',
    onInputChange,
    onSubmit,
    errorState = null,
    onErrorDismiss,
    onChatFinish,
    onUpdateStreamlit,
    onCodeClick,
    isInChatPage = false,
    onTogglePanel,
}: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const { isPreviewMode, showAuthPrompt } = useAuth()
    const { isUploading, progress, error: fileError } = useFileStore()

    // Handle submission
    const handleSubmit = async (
        e: React.FormEvent,
        message: string,
        file?: File,
        fileId?: string
    ) => {
        e.preventDefault()
        if ((!message.trim() && !file) || isPreviewMode) {
            if (isPreviewMode) {
                showAuthPrompt()
            }
            return
        }

        try {
            await onSubmit(e, message, file, fileId)
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

    // Use fileError from FileStore
    useEffect(() => {
        if (fileError) {
            // Handle file error
            console.error('File upload error:', fileError)
        }
    }, [fileError])

    return (
        <div className="flex flex-col relative z-20 text-black h-full">
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

            {fileError && (
                <Alert
                    variant="destructive"
                    className="mb-4 absolute top-0 left-0 right-0 z-50"
                >
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                        {typeof fileError === 'string' ? fileError : fileError}
                    </AlertDescription>
                </Alert>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 space-y-4 w-full max-w-[800px] m-auto pb-[120px]">
                {Array.isArray(messages) &&
                    messages.map((message, index) => {
                        const typedMessage = {
                            ...message,
                            data: message.data as MessageData | undefined
                        }
                        
                        return (
                            <AIMessage
                                key={message.id}
                                {...typedMessage}
                                isLastMessage={index === messages.length - 1}
                                isLoading={isLoading}
                                onCodeClick={handleCodeClick}
                                onTogglePanel={() => onTogglePanel('right')}
                                onInputChange={onInputChange}
                            />
                        )
                    })}
                <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Chatbar with absolute positioning */}
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-dark-app">
                <Chatbar
                    value={input}
                    onChange={onInputChange}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    isInChatPage={isInChatPage}
                />
            </div>
        </div>
    )
}

export default React.memo(Chat)
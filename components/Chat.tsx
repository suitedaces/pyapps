'use client'

import Chatbar from '@/components/core/chatbar'
import { Message as AIMessage } from '@/components/core/message'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/AuthContext'
import { Message } from 'ai'
import { XCircle } from 'lucide-react'
import React, { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

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
    onAppend?: (message: string) => void
    errorState: Error | null
    onErrorDismiss: () => void
    onUpdateStreamlit: (code: string) => void
    onCodeClick: (code: string) => void
    isInChatPage: boolean
    onTogglePanel: (panel: string) => void
    chatId?: string
    selectedFileIds?: string[]
    onFileSelect?: (fileIds: string[]) => void
    isRightPanelOpen?: boolean
}


function Chat({
    messages = [],
    isLoading = false,
    input = '',
    onInputChange,
    onSubmit,
    onAppend,
    errorState = null,
    onErrorDismiss,
    onUpdateStreamlit,
    onCodeClick,
    isInChatPage = false,
    onTogglePanel,
    chatId,
    selectedFileIds = [],
    onFileSelect,
    isRightPanelOpen = false,
}: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const { isPreviewMode, showAuthPrompt } = useAuth()
    const scrollTimeoutRef = useRef<NodeJS.Timeout>()

    // Auto-scroll when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            // Clear any existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
            // Set new timeout for scroll
            scrollTimeoutRef.current = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
        }
        // Cleanup
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
        }
    }, [messages])

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
        } catch (error) {
            console.error('Error submitting message:', error)
        }
    }

    // Handle code click with Streamlit update
    const handleCodeClick = (code: string) => {
        onCodeClick?.(code)
        onUpdateStreamlit?.(code)
    }

    return (
        <div className="flex flex-col h-full relative z-20">
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

            {/* Messages */}
            <div className="flex-1 min-h-0 relative z-20">
                <ScrollArea className={cn(
                    "h-full",
                    !isRightPanelOpen && "max-w-[1000px] m-auto"
                )}>
                    <div className={cn(
                        "p-3 space-y-3",
                        isInChatPage ? "pb-[120px]" : "pb-4",
                        isRightPanelOpen && "p-2 sm:p-3 space-y-2"
                    )}>
                        {Array.isArray(messages) &&
                            messages.map((message, index) => {
                                const prevMessage = index > 0 ? messages[index - 1] : null;
                                const showAvatar = message.role === 'assistant' && 
                                    (!prevMessage || prevMessage.role === 'user' || prevMessage.role === 'system');

                                return (
                                    <AIMessage
                                        key={`${message.id}-${index}`}
                                        {...message}
                                        data={message.data as { type: string; actions?: any[] }}
                                        isLastMessage={index === messages.length - 1}
                                        isLoading={isLoading}
                                        onCodeClick={handleCodeClick}
                                        onTogglePanel={() => onTogglePanel('right')}
                                        onInputChange={onInputChange}
                                        onAppend={onAppend}
                                        showAvatar={showAvatar}
                                    />
                                );
                            })}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>
            </div>

            {/* Chatbar */}
            <div className={cn(
                "w-full max-w-[1000px] mx-auto bg-white dark:bg-dark-app z-30",
                isRightPanelOpen && "w-full max-w-none"
            )}>
                <Chatbar
                    value={input}
                    onChange={onInputChange}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    isInChatPage={isInChatPage}
                    chatId={chatId}
                    selectedFileIds={selectedFileIds}
                    onFileSelect={onFileSelect}
                    isRightPanelOpen={isRightPanelOpen}
                />
            </div>
        </div>
    )
}

export default React.memo(Chat)

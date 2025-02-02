'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { App, ExecutionResult } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { ActionPanel } from './action-panel'
import { assistantMarkdownStyles, userMarkdownStyles, markdownToHtml } from './markdown'
import { Logo } from '@/components/core/Logo'
import { FileUpload } from '@/components/core/FileUpload'
import { Suggestions } from '@/components/core/Suggestions'

interface ActionButton {
    label: string
    value: string
    [key: string]: string
}

interface MessageContent {
    text?: string
    type?: string
    args?: any
    toolName?: string
    toolCallId?: string
    result?: any
}

interface MessageProps {
    id: string
    role: 'system' | 'user' | 'assistant' | 'tool' | 'data'
    content: string | MessageContent[] | any
    isLastMessage?: boolean
    showAvatar?: boolean
    isLoading?: boolean
    object?: App
    result?: ExecutionResult
    onObjectClick?: (preview: {
        object: App | undefined
        result: ExecutionResult | undefined
    }) => void
    onToolResultClick?: (result: string) => void
    onCodeClick?: (messageId: string) => void
    isCreatingChat?: boolean
    onTogglePanel?: () => void
    data?: {
        type: string
        actions?: ActionButton[]
        file?: any
    }
    onInputChange?: (value: string) => void
    onAppend?: (message: string) => void
    toolInvocations?: any[]
}

export function Message({
    role,
    content,
    id,
    isLastMessage = false,
    toolInvocations,
    isLoading = false,
    isCreatingChat = false,
    onTogglePanel,
    data,
    onInputChange,
    onAppend,
    showAvatar = true,
}: MessageProps) {
    // Skip rendering for tool messages
    if (role === 'tool') return null;
    
    const isUser = role === 'user'
    const { session } = useAuth()
    const user = session?.user
    const messageEndRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const renderMarkdown = async () => {
            if (!contentRef.current) return
            
            let textContent = ''
            if (typeof content === 'string') {
                textContent = content
            } else if (Array.isArray(content)) {
                // Extract text content from array of content objects
                textContent = content
                    .filter(item => item.type === 'text')
                    .map(item => item.text)
                    .join('\n\n')
            }
            
            if (!textContent) return
            
            try {
                const html = await markdownToHtml(textContent)
                if (contentRef.current) {
                    contentRef.current.innerHTML = html
                }
            } catch (error) {
                console.error('Error rendering markdown:', error)
            }
        }
        renderMarkdown()
    }, [content])

    useEffect(() => {
        if (isLastMessage && messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [isLastMessage, content])

    // Extract tool calls from content if it's an array
    const extractedToolCalls = Array.isArray(content) 
        ? content.filter(item => item.type === 'tool-call').map(item => ({
            toolName: item.toolName,
            toolCallId: item.toolCallId,
            args: item.args
        }))
        : undefined

    // Extract suggestions from both toolInvocations and content
    const getSuggestions = () => {
        // Check toolInvocations first
        const toolInvocationSuggestions = toolInvocations?.find(inv => inv.toolName === 'suggestionsTool');

        if (toolInvocationSuggestions) {
            return toolInvocationSuggestions.args || toolInvocationSuggestions.result;
        }

        // Check content array for tool calls
        const contentSuggestions = extractedToolCalls?.find(call => call.toolName === 'suggestionsTool');

        if (contentSuggestions) {
            return contentSuggestions.args;
        }

        return null;
    };

    const isSuggestionsLoading = isLoading && (
        toolInvocations?.some(inv => inv.toolName === 'suggestionsTool') ||
        extractedToolCalls?.some(call => call.toolName === 'suggestionsTool')
    );

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={id}
                initial={isCreatingChat ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={isCreatingChat ? { opacity: 0 } : undefined}
                transition={{ duration: 0.2 }}
                className={cn(
                    'flex w-full',
                    isUser ? 'justify-end' : 'justify-start',
                    isUser ? 'mb-6 mt-6' : 'mb-2'
                )}
            >
                {!isUser ? (
                    <div className="flex flex-row items-start w-full overflow-hidden">
                        <div className={cn(
                            "w-8 h-8 mt-5 flex-shrink-0 flex items-center justify-center",
                            !showAvatar && "opacity-0"
                        )}>
                            <Logo collapsed inverted className="scale-75" />
                        </div>
                        <div className={cn(
                            "mx-2 break-words w-full dark:text-dark-text overflow-hidden",
                            showAvatar ? "p-4" : "p-1",
                            showAvatar ? "mt-0" : "-mt-2"
                        )}>
                            <div 
                                ref={contentRef}
                                className={cn("max-w-[calc(100%-2rem)] overflow-x-auto text-neutral-900 dark:text-neutral-100", assistantMarkdownStyles)}
                            />

                            {/* Render suggestions if they exist */}
                            <Suggestions 
                                suggestions={getSuggestions()} 
                                isLoading={isSuggestionsLoading || false}
                                onInputChange={onInputChange}
                                onAppend={onAppend}
                            />

                            {/* Action buttons */}
                            {data?.type === 'action_buttons' && data.actions && (
                                <motion.div 
                                    className="flex flex-wrap gap-2 mt-4"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {data.actions.map((action, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                if (onInputChange) {
                                                    onInputChange(action.value)
                                                }
                                            }}
                                            className={cn(
                                                "px-4 py-2 text-sm font-medium",
                                                "bg-black dark:bg-dark-background",
                                                "text-white",
                                                "border-2 border-black dark:border-white",
                                                "shadow-[2px_2px_0px_0px_rgba(0,0,0)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255)]",
                                                "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
                                                "transition-all"
                                            )}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}

                            {/* Streamlit tool panel */}
                            {(Boolean(toolInvocations?.some(inv => inv.toolName === 'streamlitTool')) || 
                              Boolean(extractedToolCalls?.some(call => call.toolName === 'streamlitTool'))) && (
                                <ActionPanel
                                    isLoading={Boolean(isLoading)}
                                    isLastMessage={Boolean(isLastMessage)}
                                    onTogglePanel={onTogglePanel}
                                />
                            )}

                            {isLastMessage && isLoading && !toolInvocations?.length && !extractedToolCalls?.length && (
                                <motion.div
                                    className="w-2 h-4 bg-black/40 dark:bg-white/40 mt-1"
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        ease: 'linear',
                                    }}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-row items-start gap-2 max-w-[85%]">
                        <div className="grow-0 mx-2 py-3 px-4 rounded-lg bg-background border border-border text-foreground overflow-auto">
                            <div 
                                ref={contentRef}
                                className={userMarkdownStyles}
                            />
                            {/* Add file upload rendering */}
                            {data?.type === 'file_upload' && (
                                <FileUpload file={data.file} />
                            )}
                        </div>
                        <Avatar className="w-8 h-8 bg-blue-500 border-2 border-border flex-shrink-0 mt-1">
                            {user?.user_metadata?.avatar_url ? (
                                <AvatarImage
                                    src={user.user_metadata.avatar_url}
                                    alt={user.user_metadata.full_name || 'User'}
                                />
                            ) : (
                                <AvatarFallback>
                                    {user?.user_metadata?.full_name?.[0]?.toUpperCase() ||
                                        user?.email?.[0]?.toUpperCase() ||
                                        'U'}
                                </AvatarFallback>
                            )}
                        </Avatar>
                    </div>
                )}
                <div ref={messageEndRef} />
            </motion.div>
        </AnimatePresence>
    )
}

export default Message
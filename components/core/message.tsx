'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { App, ExecutionResult } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { Message as AIMessage } from 'ai'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { ActionPanel } from './action-panel'
import { assistantMarkdownStyles, userMarkdownStyles, markdownToHtml } from './markdown'

interface ActionButton {
    label: string
    value: string
    [key: string]: string
}

interface MessageProps extends Omit<AIMessage, 'data'> {
    isLastMessage?: boolean
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
    }
    onInputChange?: (value: string) => void
}

export function Message({
    role,
    content,
    id,
    isLastMessage = false,
    toolInvocations,
    isLoading,
    isCreatingChat = false,
    onTogglePanel,
    data,
    onInputChange,
}: MessageProps) {
    const isUser = role === 'user'
    const { session } = useAuth()
    const user = session?.user
    const messageEndRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    
    useEffect(() => {
        if (contentRef.current) {
            markdownToHtml(content).then(html => {
                if (contentRef.current) {
                    contentRef.current.innerHTML = html
                }
            })
        }
    }, [content])

    useEffect(() => {
        if (isLastMessage && messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [isLastMessage, content])

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
                    'mb-4'
                )}
            >
                {!isUser ? (
                    <div className="flex flex-row items-start w-full overflow-hidden">
                        <Avatar className="w-8 h-8 bg-[#FFD700] border-2 mt-5 border-border flex-shrink-0">
                            <AvatarFallback>A</AvatarFallback>
                        </Avatar>
                        <div className="mx-2 p-4 break-words w-full dark:text-dark-text overflow-hidden">
                            <div 
                                ref={contentRef}
                                className={cn("max-w-[calc(100%-2rem)] overflow-x-auto", assistantMarkdownStyles)}
                            />

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
                                                console.log('Action button clicked:', action.value);
                                                if (onInputChange) {
                                                    console.log('Calling onInputChange with:', action.value);
                                                    onInputChange(action.value);
                                                } else {
                                                    console.log('onInputChange is not defined');
                                                }
                                            }}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-sm font-medium",
                                                "bg-gradient-to-tr from-[#FFDE56] to-[#4989BB] hover:opacity-90",
                                                "dark:from-[#03f241] dark:via-[#d549dd] dark:to-[#03e5f2]",
                                                "text-black dark:text-white",
                                                "transition-all duration-200 shadow-lg hover:shadow-xl"
                                            )}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}

                            {Boolean(toolInvocations?.length) && (
                                <ActionPanel
                                    isLoading={isLoading}
                                    isLastMessage={isLastMessage}
                                    onTogglePanel={onTogglePanel}
                                />
                            )}

                            {isLastMessage && isLoading && !toolInvocations?.length && (
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
                        <div className="grow-0 mx-2 py-2 px-3 rounded-lg bg-background border border-border text-foreground overflow-auto">
                            <div 
                                ref={contentRef}
                                className={userMarkdownStyles}
                            />
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
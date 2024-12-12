'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { App, ExecutionResult } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { Message as AIMessage, ToolInvocation } from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal } from 'lucide-react'
import { useRef, useEffect, useMemo } from 'react'
import { Markdown } from './markdown'
import { MessageButton } from './message-button'
import { useToolState } from '@/lib/stores/tool-state-store'
import { SuggestionsChecklist } from './SuggestionsChecklist'

interface MessageProps extends AIMessage {
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
}

export function Message({
    role,
    content,
    id,
    isLastMessage = false,
    object,
    result,
    toolInvocations,
    onObjectClick,
    onToolResultClick,
    onCodeClick,
    isLoading,
    isCreatingChat = false,
}: MessageProps) {
    const isUser = role === 'user'
    const { session } = useAuth()
    const user = session?.user
    const messageEndRef = useRef<HTMLDivElement>(null)
    const { currentToolCall } = useToolState()

    // Auto-scroll effect
    useEffect(() => {
        if (isLastMessage && messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [isLastMessage, content])

    // Memoize content lines for better streaming performance
    const contentLines = useMemo(() =>
        content.split('\n').filter(Boolean)
    , [content])

    // Add this function inside the Message component
    const handleMetricToggle = (metric: string, checked: boolean) => {
        // Here you can handle what happens when a metric is toggled
        console.log(`Metric ${metric} ${checked ? 'checked' : 'unchecked'}`)
        if (checked && onToolResultClick) {
            onToolResultClick(metric)
        }
    }

    // Update the renderToolInvocations function to include suggestions handling
    const renderToolInvocations = () => {
        if (!toolInvocations?.length) return null

        return (
            <>
                {toolInvocations.map((invocation: ToolInvocation) => {
                    if (invocation.toolName === 'suggestionsTool' && invocation.state === 'result') {
                        return (
                            <SuggestionsChecklist
                                key={invocation.toolCallId}
                                metrics={invocation.result.metrics}
                                onMetricToggle={handleMetricToggle}
                            />
                        )
                    }
                    return null
                })}
                <MessageButton
                    toolInvocations={toolInvocations}
                    object={object}
                    result={result}
                    onObjectClick={onObjectClick}
                    onToolResultClick={onToolResultClick}
                    onCodeClick={onCodeClick}
                    messageId={id}
                    isLastMessage={isLastMessage}
                    isLoading={isLoading}
                />
            </>
        )
    }

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
                    <div className="flex flex-row items-start w-full">
                        <Avatar className="w-8 h-8 bg-[#FFD700] border-2 mt-5 border-border flex-shrink-0">
                            <AvatarFallback>A</AvatarFallback>
                        </Avatar>
                        <div className="mx-2 p-4 break-words w-full dark:text-dark-text">
                            {/* Streamed content */}
                            <AnimatePresence mode="popLayout">
                                {contentLines.map((line, i) => (
                                    <motion.div
                                        key={`${id}-${i}`}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        transition={{
                                            duration: 0.2,
                                            delay: i * 0.1
                                        }}
                                    >
                                        <Markdown>{line}</Markdown>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Tool streaming indicator */}
                            {isLastMessage && isLoading && currentToolCall.state === 'streaming-start' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300 mt-2"
                                >
                                    <Terminal className="w-4 h-4 animate-pulse" />
                                    <span>Generating Streamlit app...</span>
                                </motion.div>
                            )}

                            {/* Tool invocations */}
                            {renderToolInvocations()}

                            {/* Typing indicator for streaming */}
                            {isLastMessage && isLoading && (
                                <motion.div
                                    className="w-2 h-4 bg-black/40 dark:bg-white/40 mt-1"
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-row items-start gap-2 max-w-[85%]">
                        <div className="grow shrink mx-2 p-4 rounded-lg bg-background border border-border text-foreground overflow-auto">
                            <div className="whitespace-pre-wrap break-words max-w-full">
                                <Markdown>{content}</Markdown>
                            </div>
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

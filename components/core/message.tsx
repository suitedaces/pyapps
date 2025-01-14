'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { App, ExecutionResult } from '@/lib/schema'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { cn } from '@/lib/utils'
import { Message as AIMessage } from 'ai'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'
import { ActionPanel } from './action-panel'
import { Markdown } from './markdown'

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
    onTogglePanel?: () => void
    data?: {
        type: string
        actions?: Array<{
            label: string
            action: string
            prompt: string
        }>
    }
    onActionClick?: (prompt: string) => void
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
    onActionClick,
}: MessageProps) {
    const isUser = role === 'user'
    const { session } = useAuth()
    const user = session?.user
    const messageEndRef = useRef<HTMLDivElement>(null)
    const setGeneratingCode = useSandboxStore(
        (state) => state.setGeneratingCode
    )
    const hasPanelOpened = useRef(false)

    // Auto-scroll effect
    useEffect(() => {
        if (isLastMessage && messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [isLastMessage, content])

    // Memoize content lines for better streaming performance
    const contentLines = useMemo(
        () => content.split('\n').filter(Boolean),
        [content]
    )

    // Reset the ref when the message changes
    useEffect(() => {
        if (id) {
            hasPanelOpened.current = false
        }
    }, [id])

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
                            <AnimatePresence mode="popLayout">
                                {contentLines.map((line, i) => (
                                    <motion.div
                                        key={`${id}-${i}`}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        transition={{
                                            duration: 0.2,
                                            delay: i * 0.1,
                                        }}
                                    >
                                        <Markdown>{line}</Markdown>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {data?.type === 'action_buttons' && data.actions && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {data.actions.map((action, index) => (
                                        <button
                                            key={index}
                                            onClick={() => onActionClick?.(action.prompt)}
                                            className="px-4 py-2 text-sm rounded-lg border border-border bg-white hover:bg-gray-50 dark:bg-dark-app dark:hover:bg-dark-border transition-colors"
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {Boolean(toolInvocations?.length) && (
                                <ActionPanel
                                    isLoading={isLoading}
                                    isLastMessage={isLastMessage}
                                    onTogglePanel={onTogglePanel}
                                />
                            )}

                            {isLastMessage &&
                                isLoading &&
                                !toolInvocations?.length && (
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

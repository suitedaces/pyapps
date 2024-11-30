'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { App, ExecutionResult } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { Message as AIMessage, ToolInvocation } from 'ai'
import { motion } from 'framer-motion'
import { Terminal } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Markdown } from './markdown'
import { MessageButton } from './message-button'

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

    const renderPreviewButton = () => {
        if (!toolInvocations?.length && !object) return null

        return (
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
        )
    }

    return (
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
            {!isUser && (
                <div className="flex flex-row items-start w-full">
                    <Avatar className="w-8 h-8 bg-[#FFD700] border-2 mt-5 border-border flex-shrink-0">
                        <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <div className="mx-2 p-4 break-words w-full">
                        <Markdown>{content}</Markdown>
                        {renderPreviewButton()}
                    </div>
                </div>
            )}

            {isUser && (
                <div className="flex flex-row items-start gap-2 max-w-[85%]">
                    <div className="grow shrink mx-2 p-4 rounded-lg bg-background border border-border text-foreground overflow-auto">
                        <div className="whitespace-pre-wrap break-words max-w-full">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => (
                                        <div className="mb-4 last:mb-0">
                                            {children}
                                        </div>
                                    ),
                                }}
                            >
                                {content}
                            </ReactMarkdown>
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
        </motion.div>
    )
}

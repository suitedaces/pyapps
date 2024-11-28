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

interface MessageProps extends AIMessage {
    isLastMessage?: boolean
    object?: App
    result?: ExecutionResult
    onObjectClick?: (preview: {
        object: App | undefined
        result: ExecutionResult | undefined
    }) => void
    onToolResultClick?: (result: string) => void
    onCodeClick?: (messageId: string) => void
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
}: MessageProps) {
    const isUser = role === 'user'
    const { session } = useAuth()
    const user = session?.user

    const streamlitResult = toolInvocations?.find(
        (invocation) =>
            invocation.toolName === 'create_streamlit_app' &&
            invocation.state === 'result' &&
            'result' in invocation
    ) as (ToolInvocation & { result: string }) | undefined

    const renderPreviewButton = () => {
        if (object) {
            return (
                <div
                    onClick={() => {
                        onObjectClick?.({ object, result })
                        onCodeClick?.(id)
                    }}
                    className="py-2 my-4 pl-2 w-full md:w-max flex items-center border rounded-xl select-none hover:bg-white dark:hover:bg-white/5 hover:cursor-pointer"
                >
                    <div className="rounded-[0.5rem] w-10 h-10 bg-black/5 dark:bg-white/5 self-stretch flex items-center justify-center">
                        <Terminal strokeWidth={2} className="text-[#FF8800]" />
                    </div>
                    <div className="pl-2 pr-4 flex flex-col">
                        <span className="font-bold font-sans text-sm text-primary">
                            {object.title}
                        </span>
                        <span className="font-sans text-sm text-muted-foreground">
                            Click to see code
                        </span>
                    </div>
                </div>
            )
        } else if (streamlitResult) {
            return (
                <div
                    onClick={() => {
                        onToolResultClick?.(streamlitResult.result)
                        onCodeClick?.(id)
                    }}
                    className="py-2 my-4 pl-2 w-full md:w-max flex items-center border rounded-xl select-none hover:bg-white dark:hover:bg-white/5 hover:cursor-pointer"
                >
                    <div className="rounded-[0.5rem] w-10 h-10 bg-black/5 dark:bg-white/5 self-stretch flex items-center justify-center">
                        <Terminal strokeWidth={2} className="text-[#FF8800]" />
                    </div>
                    <div className="pl-2 pr-4 flex flex-col">
                        <span className="font-bold font-sans text-sm text-primary">
                            Streamlit App Code
                        </span>
                        <span className="font-sans text-sm text-muted-foreground">
                            Click to see code
                        </span>
                    </div>
                </div>
            )
        }
        return null
    }

    return (
        <motion.div
            key={id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
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

'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { App, ExecutionResult } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ActionPanel } from './action-panel'
import { assistantMarkdownStyles, userMarkdownStyles, markdownToHtml } from './markdown'
import { Logo } from '@/components/core/Logo'
import { Check as CheckIcon, Copy as CopyIcon } from 'lucide-react'

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
    }
    onInputChange?: (value: string) => void
    toolInvocations?: any[]
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
    showAvatar = true,
}: MessageProps) {
    // Skip rendering for tool messages
    if (role === 'tool') return null;
    
    const isUser = role === 'user'
    const { session } = useAuth()
    const user = session?.user
    const messageEndRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [copiedItem, setCopiedItem] = useState<string | null>(null);

    const handleItemClick = (item: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(item)) {
                newSet.delete(item);
            } else {
                newSet.add(item);
            }
            return newSet;
        });
    };

    const compilePrompt = () => {
        const selectedArray = Array.from(selectedItems);
        if (selectedArray.length === 0) return;

        const prompt = `I want to analyze the following aspects:\n\n${selectedArray.map(item => `- ${item}`).join('\n')}`;
        if (onInputChange) {
            onInputChange(prompt);
        }
    };

    const handleCopy = async (text: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            setCopiedItem(text);
            setTimeout(() => setCopiedItem(null), 1000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

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
        console.log('🔍 Debug - toolInvocations:', toolInvocations);
        console.log('🔍 Debug - content:', content);
        console.log('🔍 Debug - extractedToolCalls:', extractedToolCalls);

        // Check toolInvocations first
        const toolInvocationSuggestions = toolInvocations?.find(inv => {
            console.log('🔍 Debug - checking invocation:', inv);
            return inv.toolName === 'suggestionsTool';
        });

        console.log('🔍 Debug - toolInvocationSuggestions:', toolInvocationSuggestions);

        if (toolInvocationSuggestions) {
            console.log('🔍 Debug - returning suggestions from toolInvocations');
            return toolInvocationSuggestions.args || toolInvocationSuggestions.result;
        }

        // Check content array for tool calls
        const contentSuggestions = extractedToolCalls?.find(call => {
            console.log('🔍 Debug - checking content call:', call);
            return call.toolName === 'suggestionsTool';
        });

        console.log('🔍 Debug - contentSuggestions:', contentSuggestions);

        if (contentSuggestions) {
            console.log('🔍 Debug - returning suggestions from content');
            return contentSuggestions.args;
        }

        console.log('🔍 Debug - no suggestions found');
        return null;
    };

    const renderSuggestions = (suggestions: any) => {
        if (!suggestions) return null;

        const metrics = suggestions.keyMetrics || suggestions.metrics;
        const questions = suggestions.keyQuestions || suggestions.questions;
        const interactions = suggestions.userInteractions || suggestions.interactions;

        const renderSection = (title: string, items: string[], color: string, bgColor: string, borderColor: string) => {
            if (!items?.length) return null;
            
            return (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className={cn("h-1 w-1 rounded-full", color)}></div>
                        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            {title} • {items.length}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {items.map((item, i) => (
                            <div 
                                key={i}
                                onClick={() => handleItemClick(item)}
                                className={cn(
                                    "group relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded",
                                    "text-[11px] leading-4 font-medium cursor-pointer select-none",
                                    "transition-all duration-150 ease-in-out",
                                    "hover:ring-1 ring-offset-1 ring-black/5 dark:ring-white/5",
                                    selectedItems.has(item) 
                                        ? cn("text-white dark:text-white", color, "shadow-sm")
                                        : cn("text-neutral-700 dark:text-neutral-300", bgColor, borderColor)
                                )}
                            >
                                {item}
                                <button
                                    onClick={(e) => handleCopy(item, e)}
                                    className={cn(
                                        "ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                                        selectedItems.has(item) ? "text-white/70" : "text-neutral-400"
                                    )}
                                >
                                    {copiedItem === item ? (
                                        <CheckIcon className="w-2.5 h-2.5" />
                                    ) : (
                                        <CopyIcon className="w-2.5 h-2.5" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        };
        
        return (
            <motion.div 
                className="mt-3 space-y-4"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                <div className="space-y-3 px-0.5">
                    {renderSection(
                        "Key Metrics",
                        metrics,
                        "bg-emerald-500",
                        selectedItems.size ? "bg-emerald-500/10" : "bg-neutral-100 dark:bg-neutral-800",
                        "border border-emerald-100 dark:border-emerald-500/20"
                    )}
                    {renderSection(
                        "Key Questions",
                        questions,
                        "bg-blue-500",
                        selectedItems.size ? "bg-blue-500/10" : "bg-neutral-100 dark:bg-neutral-800",
                        "border border-blue-100 dark:border-blue-500/20"
                    )}
                    {renderSection(
                        "Suggested Filters",
                        interactions?.filters,
                        "bg-purple-500",
                        selectedItems.size ? "bg-purple-500/10" : "bg-neutral-100 dark:bg-neutral-800",
                        "border border-purple-100 dark:border-purple-500/20"
                    )}
                </div>

                {selectedItems.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex justify-end"
                    >
                        <button
                            onClick={compilePrompt}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-md",
                                "bg-black dark:bg-white",
                                "text-white dark:text-black",
                                "hover:bg-black/90 dark:hover:bg-white/90",
                                "transition-colors duration-200",
                                "flex items-center gap-2"
                            )}
                        >
                            Analyze Selected ({selectedItems.size})
                        </button>
                    </motion.div>
                )}
            </motion.div>
        );
    };

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
                                className={cn("max-w-[calc(100%-2rem)] overflow-x-auto", assistantMarkdownStyles)}
                            />

                            {/* Render suggestions if they exist */}
                            {renderSuggestions(getSuggestions())}

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
                                    isLoading={isLoading}
                                    isLastMessage={isLastMessage}
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
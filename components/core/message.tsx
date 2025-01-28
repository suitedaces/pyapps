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
import { Check as CheckIcon, Copy as CopyIcon, BarChart3 as MetricsIcon, HelpCircle as QuestionsIcon, ChevronRight as ChevronIcon, Loader2, Sparkles } from 'lucide-react'

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
        // Only show loading state if we're waiting for suggestionsTool specifically
        const isSuggestionsLoading = isLoading && (
            toolInvocations?.some(inv => inv.toolName === 'suggestionsTool') ||
            extractedToolCalls?.some(call => call.toolName === 'suggestionsTool')
        );

        if (!suggestions && isSuggestionsLoading) {
            return (
                <motion.div 
                    className="mt-4 space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                >
                    <div className="space-y-4 bg-neutral-50/50 dark:bg-neutral-900/50 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                        {/* Metrics Skeleton */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 animate-pulse">
                                    <div className="w-4 h-4" />
                                </div>
                                <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-6 w-32 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        </div>
                        {/* Questions Skeleton */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1 rounded-md bg-blue-50 dark:bg-blue-500/10 animate-pulse">
                                    <div className="w-4 h-4" />
                                </div>
                                <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="h-6 w-40 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            );
        }

        if (!suggestions) return null;

        const metrics = suggestions.keyMetrics || suggestions.metrics;
        const questions = suggestions.keyQuestions || suggestions.questions;

        // Update the getAnalyzeButtonColors function
        const getAnalyzeButtonColors = () => {
            const hasMetrics = Array.from(selectedItems).some(item => metrics?.includes(item));
            const hasQuestions = Array.from(selectedItems).some(item => questions?.includes(item));
            
            return {
                bg: "bg-white/5 dark:bg-black/5 backdrop-blur-sm",
                text: "text-black dark:text-white",
                shadow: "shadow-[2px_2px_0px_0px_rgba(0,0,0)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255)]",
                hover: "hover:bg-white/10 dark:hover:bg-black/10"
            };
        };

        const renderSection = (title: string, items: string[], icon: React.ReactNode, color: string, bgColor: string, borderColor: string) => {
            if (!items?.length) return null;
            
            return (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className={cn("p-1 rounded-md", bgColor)}>
                            {icon}
                        </div>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {title}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                            {items.length}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {items.map((item, i) => (
                            <div 
                                key={i}
                                onClick={() => handleItemClick(item)}
                                className={cn(
                                    "group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
                                    "text-xs font-medium cursor-pointer select-none",
                                    "transition-all duration-150 ease-in-out",
                                    "hover:ring-2 ring-offset-2 ring-black/5 dark:ring-white/5",
                                    selectedItems.has(item) 
                                        ? cn("text-white dark:text-white", color, "shadow-md")
                                        : cn(
                                            "text-neutral-700 dark:text-neutral-300", 
                                            bgColor,
                                            borderColor,
                                            "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                          )
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
                                        <CheckIcon className="w-3.5 h-3.5" />
                                    ) : (
                                        <CopyIcon className="w-3.5 h-3.5" />
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
                className="mt-4 space-y-4"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                <div className="space-y-4 bg-neutral-50/50 dark:bg-neutral-900/50 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    {renderSection(
                        "Metrics",
                        metrics,
                        <MetricsIcon className="w-4 h-4 text-emerald-500" />,
                        "bg-emerald-500",
                        "bg-emerald-50 dark:bg-emerald-500/10",
                        "border-2 border-emerald-100 dark:border-emerald-500/20"
                    )}
                    {renderSection(
                        "Questions",
                        questions,
                        <QuestionsIcon className="w-4 h-4 text-blue-500" />,
                        "bg-blue-500",
                        "bg-blue-50 dark:bg-blue-500/10",
                        "border-2 border-blue-100 dark:border-blue-500/20"
                    )}

                    {selectedItems.size > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="flex justify-end pt-2"
                        >
                            <motion.button
                                onClick={compilePrompt}
                                disabled={isLoading}
                                initial={{ backgroundColor: "rgba(0, 0, 0, 0.01)" }}
                                animate={{ 
                                    backgroundColor: [
                                        "rgba(0, 0, 0, 0.01)",
                                        "rgba(16, 185, 129, 0.15)",  // emerald-500/15
                                        "rgba(59, 130, 246, 0.15)",  // blue-500/15
                                        "rgba(0, 0, 0, 0.01)"
                                    ],
                                    transition: { 
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }
                                }}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-medium",
                                    "flex items-center gap-2",
                                    "border-2 border-black dark:border-white",
                                    "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
                                    "transition-all duration-75",
                                    "backdrop-blur-[2px]",
                                    "rounded-md",
                                    isLoading ? "opacity-70 cursor-not-allowed" : "",
                                    "text-black dark:text-white",
                                    "shadow-[2px_2px_0px_0px_rgba(0,0,0)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255)]"
                                )}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2 opacity-70">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    <motion.div 
                                        className="flex items-center gap-1.5"
                                        initial={{ color: "currentColor" }}
                                        animate={{ 
                                            color: [
                                                "currentColor",
                                                "rgb(16, 185, 129)",  // emerald-500
                                                "rgb(59, 130, 246)",  // blue-500
                                                "currentColor"
                                            ],
                                            transition: { 
                                                duration: 4,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                            }
                                        }}
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        <span>Create</span>
                                    </motion.div>
                                )}
                            </motion.button>
                        </motion.div>
                    )}
                </div>
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
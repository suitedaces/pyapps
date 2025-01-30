import { motion } from 'framer-motion'
import { BarChart3 as MetricsIcon, HelpCircle as QuestionsIcon, Check as CheckIcon, Copy as CopyIcon, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface SuggestionsProps {
    suggestions: any
    isLoading: boolean
    onInputChange?: (value: string) => void
    onAppend?: (message: string) => void
}

export function Suggestions({ suggestions, isLoading, onInputChange, onAppend }: SuggestionsProps) {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    const [copiedItem, setCopiedItem] = useState<string | null>(null)

    const handleItemClick = (item: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev)
            if (newSet.has(item)) {
                newSet.delete(item)
            } else {
                newSet.add(item)
            }
            return newSet
        })
    }

    const handleCopy = async (text: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await navigator.clipboard.writeText(text)
            setCopiedItem(text)
            setTimeout(() => setCopiedItem(null), 1000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const compilePrompt = () => {
        const selectedArray = Array.from(selectedItems)
        if (selectedArray.length === 0) return

        const prompt = `I want to analyze the following aspects:\n\n${selectedArray.map(item => `- ${item}`).join('\n')}`
        
        if (onAppend) {
            onAppend(prompt)
        } else if (onInputChange) {
            onInputChange(prompt)
        }
    }

    if (!suggestions && isLoading) {
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
        )
    }

    if (!suggestions) return null

    const metrics = suggestions.keyMetrics || suggestions.metrics
    const questions = suggestions.keyQuestions || suggestions.questions

    const renderSection = (title: string, items: string[], icon: React.ReactNode, color: string, bgColor: string, borderColor: string) => {
        if (!items?.length) return null
        
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
        )
    }
    
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
    )
} 
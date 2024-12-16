'use client'

import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Code2, Play } from 'lucide-react'
import { useCallback } from 'react'

interface ActionPanelProps {
    isLoading?: boolean
    isLastMessage?: boolean
    onTogglePanel?: () => void
}

export function ActionPanel({
    isLoading,
    isLastMessage,
    onTogglePanel,
}: ActionPanelProps) {
    const handleAction = useCallback(() => {
        if (isLoading) return
        onTogglePanel?.()
    }, [isLoading, onTogglePanel])

    const getStateContent = () => {
        if (!isLoading || !isLastMessage) {
            return {
                icon: Play,
                text: 'App',
                variant: 'default' as const
            }
        }

        return {
            icon: Code2,
            text: 'Generating code...',
            variant: 'secondary' as const
        }
    }

    const { icon: Icon, text, variant } = getStateContent()
    const isDisabled = isLoading && isLastMessage

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={text}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="my-4"
            >
                <button
                    onClick={isDisabled ? undefined : handleAction}
                    className={cn(
                        'inline-flex items-center justify-center gap-3',
                        'rounded-none px-4 py-2 text-sm font-medium',
                        'ring-offset-background transition-all duration-200',
                        'focus-visible:outline-none focus-visible:ring-2',
                        'focus-visible:ring-ring focus-visible:ring-offset-2',
                        'border-2 border-black dark:border-white',
                        'hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black',
                        'dark:text-white text-black',
                        'bg-transparent',
                        'hover:-translate-y-[2px] hover:translate-x-[2px]',
                        'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]',
                        'hover:shadow-none',
                        isDisabled && 'pointer-events-none opacity-50'
                    )}
                >
                    <Icon className={cn(
                        'h-4 w-4',
                        'text-current'
                    )} />
                    <span>{text}</span>
                </button>
            </motion.div>
        </AnimatePresence>
    )
}
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
            text: 'Generating code..',
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
                        'inline-flex items-center justify-center gap-2',
                        'rounded-md px-3 py-1.5 text-sm font-medium',
                        'ring-offset-background transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2',
                        'focus-visible:ring-ring focus-visible:ring-offset-2',
                        variant === 'default' && 
                            'bg-primary text-primary-foreground hover:bg-primary/90',
                        variant === 'secondary' && 
                            'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                        isDisabled && 'pointer-events-none opacity-50'
                    )}
                >
                    <Icon className="h-4 w-4" />
                    <span>{text}</span>
                </button>
            </motion.div>
        </AnimatePresence>
    )
}
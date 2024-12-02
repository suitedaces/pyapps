'use client'

import { useToolState } from '@/lib/stores/tool-state-store'
import { cn } from '@/lib/utils'
import { Loader2, Terminal } from 'lucide-react'
import { useCallback, useMemo, useEffect } from 'react'

interface MessageButtonProps {
    toolInvocations?: any[]
    isGeneratingCode?: boolean
    isLoading?: boolean
    object?: any
    result?: any
    onObjectClick?: (preview: any) => void
    onToolResultClick?: (result: string) => void
    onCodeClick?: (messageId: string) => void
    messageId: string
    isLastMessage?: boolean
}

export function MessageButton({
    toolInvocations,
    object,
    result,
    onObjectClick,
    onToolResultClick,
    onCodeClick,
    messageId,
    isLoading,
    isLastMessage,
}: MessageButtonProps) {
    const { loadingStates, currentToolCall } = useToolState()

    // Find current tool invocation state
    const currentToolState = useMemo(() => {
        if (!toolInvocations?.length) return null

        // Check for any tool call
        const toolCall = toolInvocations[0]

        if (isLastMessage) {
            const loadingState = loadingStates[toolCall.toolCallId]
            return {
                toolCallId: toolCall.toolCallId,
                state: loadingState?.isLoading ? 'loading' : 'complete',
                progress: loadingState?.progress || 0,
                totalChunks: loadingState?.totalChunks || 0
            }
        }

        // For previous messages, always show as complete
        return {
            toolCallId: toolCall.toolCallId,
            state: 'complete',
            progress: 100,
            totalChunks: 100
        }
    }, [toolInvocations, loadingStates, isLastMessage])

    // Handle button click
    const handleClick = useCallback(() => {
        if (currentToolState?.state === 'loading') return

        if (object) {
            onObjectClick?.({ object, result })
            onCodeClick?.(messageId)
        } else if (toolInvocations?.length) {
            // Find completed tool calls
            const completedTools = toolInvocations.filter(inv =>
                inv.state === 'result' || inv.result
            )

            if (completedTools.length > 0) {
                // Use the first completed tool's result
                const toolCall = completedTools[0]
                onToolResultClick?.(toolCall.result)
                onCodeClick?.(messageId)
            }
        }
    }, [currentToolState, object, result, toolInvocations, messageId, onObjectClick, onToolResultClick, onCodeClick])

    // Show button if there are tool invocations or object
    const shouldShowButton = object || (toolInvocations?.length && toolInvocations.some(inv => inv.state === 'result' || inv.result))

    if (!shouldShowButton) return null

    // Button classes based on state
    const buttonClasses = cn(
        'py-2 my-4 pl-2 w-full md:w-max flex items-center border rounded-xl',
        'select-none hover:bg-white/5 hover:cursor-pointer transition-all duration-200',
        isLastMessage && currentToolCall.state === 'streaming-start' && 'border-gray-400',
        isLastMessage && currentToolCall.state === 'delta' && 'border-gray-600',
        !isLoading && 'hover:border-gray-400'
    )

    const iconContainerClasses = cn(
        'rounded-[0.5rem] w-10 h-10 bg-gray-100 dark:bg-gray-900',
        'self-stretch flex items-center justify-center',
        'transition-colors duration-200'
    )

    // Render button content based on state
    const renderButtonContent = () => {
        const icon = (() => {
            if (isLoading && isLastMessage) {
                return (
                    <Loader2
                        strokeWidth={2.5}
                        className="h-5 w-5 text-gray-900 dark:text-gray-100 animate-spin"
                    />
                )
            }
            return <Terminal strokeWidth={2} className="text-gray-900 dark:text-gray-100" />
        })()

        const title = (() => {
            if (isLoading && isLastMessage) {
                if (currentToolCall.state === 'streaming-start') {
                    return 'Starting Tool Execution...'
                }
                if (currentToolCall.state === 'delta') {
                    return 'Executing Tool...'
                }
            }

            if (object) return object.title

            if (toolInvocations?.length) {
                const completedTool = toolInvocations.find(inv => inv.state === 'result' || inv.result)
                if (completedTool) {
                    return `${completedTool.toolName} Result`
                }
            }
            return 'Tool Result'
        })()

        const subtitle = (() => {
            if (isLoading && isLastMessage) {
                if (currentToolCall.state === 'streaming-start') {
                    return 'Initializing...'
                }
                if (currentToolCall.state === 'delta') {
                    return 'Processing...'
                }
            }
            return 'Click to see result'
        })()

        return (
            <>
                <div className={iconContainerClasses}>{icon}</div>
                <div className="pl-2 pr-4 flex flex-col">
                    <span className="font-bold font-sans text-sm text-gray-900 dark:text-gray-100">
                        {title}
                    </span>
                    <span className="font-sans text-sm text-gray-500 dark:text-gray-400">
                        {subtitle}
                    </span>
                </div>
            </>
        )
    }

    return (
        <div
            onClick={handleClick}
            className={buttonClasses}
            role="button"
            tabIndex={0}
            aria-label={isLastMessage && currentToolCall.state ? 'Executing tool...' : 'View result'}
        >
            {renderButtonContent()}
        </div>
    )
}

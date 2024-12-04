'use client'

import { useToolState } from '@/lib/stores/tool-state-store'
import { cn } from '@/lib/utils'
import { Loader2, Terminal } from 'lucide-react'
import { useCallback, useMemo } from 'react'

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

        const toolCall = toolInvocations.find(
            (inv) => inv.toolName === 'create_streamlit_app' || inv.state === 'result'
        )

        if (!toolCall) return null

        const loadingState = loadingStates[toolCall.toolCallId]
        return {
            toolCallId: toolCall.toolCallId,
            state: loadingState?.isLoading ? 'loading' : 'complete',
            progress: loadingState?.progress || 0,
            totalChunks: loadingState?.totalChunks || 0
        }
    }, [toolInvocations, loadingStates])

    // Handle button click
    const handleClick = useCallback(() => {
        if (currentToolState?.state === 'loading') return

        if (object) {
            onObjectClick?.({ object, result })
            onCodeClick?.(messageId)
        } else if (toolInvocations?.length) {
            const toolCall = toolInvocations.find(
                (inv) => (inv.toolName === 'create_streamlit_app' || inv.state === 'result') && inv.result
            )
            if (toolCall?.result) {
                onToolResultClick?.(toolCall.result)
                onCodeClick?.(messageId)
            }
        }
    }, [currentToolState, object, result, toolInvocations, messageId, onObjectClick, onToolResultClick, onCodeClick])

    // Early return if no object or tool invocations
    if (!object && !toolInvocations?.length) return null

    // Button classes based on state
    const buttonClasses = cn(
        'py-2 my-4 pl-2 w-full md:w-max flex items-center border rounded-xl',
        'select-none hover:bg-white/5 hover:cursor-pointer transition-all duration-200',
        currentToolCall.state === 'streaming-start' && 'border-gray-400',
        currentToolCall.state === 'delta' && 'border-gray-600',
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
                    return 'Starting Code Generation...'
                }
                if (currentToolCall.state === 'delta') {
                    return 'Generating Code...'
                }
            }
            return object ? object.title : 'View Tool Results'
        })()

        const subtitle = (() => {
            if (isLoading && isLastMessage) {
                if (currentToolCall.state === 'streaming-start') {
                    return 'Initializing...'
                }
                if (currentToolCall.state === 'delta') {
                    return 'Generating code...'
                }
            }
            return 'Click to see results'
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
            aria-label={currentToolCall.state ? 'Generating code...' : 'View code'}
        >
            {renderButtonContent()}
        </div>
    )
}

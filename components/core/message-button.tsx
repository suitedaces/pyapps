import { App, ExecutionResult } from '@/lib/schema'
import { useToolState } from '@/lib/stores/tool-state-store'
import { cn } from '@/lib/utils'
import { ToolInvocation } from 'ai'
import { Loader2, Terminal } from 'lucide-react'
import { useCallback, useMemo } from 'react'

interface MessageButtonProps {
    toolInvocations?: ToolInvocation[]
    isGeneratingCode?: boolean
    object?: App
    result?: ExecutionResult
    onObjectClick?: (preview: {
        object: App | undefined
        result: ExecutionResult | undefined
    }) => void
    onToolResultClick?: (result: string) => void
    onCodeClick?: (messageId: string) => void
    messageId: string
}

export function MessageButton({
    toolInvocations,
    isGeneratingCode = false,
    object,
    result,
    onObjectClick,
    onToolResultClick,
    onCodeClick,
    messageId,
}: MessageButtonProps) {
    // Get tool state from store
    const { loadingStates, currentToolCall, setCodeViewOpen } = useToolState()

    // Type guard for tool invocation states
    const isToolResult = (
        invocation: ToolInvocation
    ): invocation is ToolInvocation & { state: 'result'; result: string } => {
        return invocation.state === 'result' && 'result' in invocation
    }

    // Find streamlit result
    const streamlitResult = useMemo(
        () =>
            toolInvocations?.find(
                (invocation) =>
                    isToolResult(invocation) &&
                    invocation.toolName === 'create_streamlit_app'
            ) as (ToolInvocation & { result: string }) | undefined,
        [toolInvocations]
    )

    // Find current tool invocation state
    const currentToolState = useMemo(() => {
        if (!toolInvocations?.length) return null

        const toolCall = toolInvocations.find(
            (inv) => inv.toolName === 'create_streamlit_app'
        )

        if (!toolCall) return null

        return {
            toolCallId: toolCall.toolCallId,
            state: loadingStates[toolCall.toolCallId]?.isLoading
                ? 'loading'
                : 'complete',
        }
    }, [toolInvocations, loadingStates])

    // Early return if no object or streamlit result
    if (!object && !streamlitResult && !currentToolState) return null

    // Handle button click with code view toggle
    const handleClick = useCallback(() => {
        if (currentToolState?.state === 'loading') return

        if (object) {
            onObjectClick?.({ object, result })
            onCodeClick?.(messageId)
            setCodeViewOpen(true)
        } else if (streamlitResult) {
            onToolResultClick?.(streamlitResult.result)
            onCodeClick?.(messageId)
            setCodeViewOpen(true)
        }
    }, [
        currentToolState,
        object,
        result,
        streamlitResult,
        messageId,
        onObjectClick,
        onToolResultClick,
        onCodeClick,
        setCodeViewOpen,
    ])

    // Determine if button should show loading state
    const isLoading = useMemo(() => {
        if (isGeneratingCode) return true
        if (!currentToolState) return false
        return currentToolState.state === 'loading'
    }, [isGeneratingCode, currentToolState])

    // Common button styles
    const buttonClasses = cn(
        'py-2 my-4 pl-2 w-full md:w-max flex items-center border rounded-xl',
        'select-none hover:bg-white dark:hover:bg-white/5 hover:cursor-pointer',
        currentToolCall.state === 'streaming' && 'border-yellow-500',
        currentToolCall.state === 'delta' && 'border-blue-500'
    )

    const iconContainerClasses = cn(
        'rounded-[0.5rem] w-10 h-10 bg-black/5 dark:bg-white/5',
        'self-stretch flex items-center justify-center'
    )

    // Render button content based on state
    const renderButtonContent = () => {
        const icon = (() => {
            if (
                isLoading ||
                currentToolCall.state === 'streaming' ||
                currentToolCall.state === 'delta'
            ) {
                return (
                    <Loader2
                        strokeWidth={2}
                        className="h-4 w-4 text-[#FF8800] animate-spin"
                    />
                )
            }
            return <Terminal strokeWidth={2} className="text-[#FF8800]" />
        })()

        const title = (() => {
            if (currentToolCall.state === 'streaming') {
                return 'Starting Code Generation...'
            }
            if (currentToolCall.state === 'delta') {
                return 'Generating Streamlit App...'
            }
            return object ? object.title : 'Streamlit App Code'
        })()

        const subtitle = (() => {
            if (
                currentToolCall.state === 'streaming' ||
                currentToolCall.state === 'delta'
            ) {
                return 'Please wait...'
            }
            return 'Click to see code'
        })()

        return (
            <>
                <div className={iconContainerClasses}>{icon}</div>
                <div className="pl-2 pr-4 flex flex-col">
                    <span className="font-bold font-sans text-sm text-primary">
                        {title}
                    </span>
                    <span className="font-sans text-sm text-muted-foreground">
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
            aria-label={
                currentToolCall.state ? 'Generating code...' : 'View code'
            }
        >
            {renderButtonContent()}
        </div>
    )
}

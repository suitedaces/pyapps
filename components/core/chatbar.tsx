'use client'

import { FilePreview } from '@/components/FilePreview'
import { useAutoResizeTextarea } from '@/components/hooks/use-auto-resize-textarea'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ArrowUp, Loader2, PaperclipIcon } from 'lucide-react'
import * as React from 'react'
import { useEffect } from 'react'

interface ChatbarProps {
    value: string
    onChange: (value: string) => void
    onSubmit: (
        e: React.FormEvent,
        message: string,
        file?: File
    ) => Promise<void>
    isLoading?: boolean
    onFileUpload?: (file: File) => void
    fileUploadState?: {
        isUploading: boolean
        progress: number
        error: string | null
    }
    isInChatPage?: boolean
    isCentered?: boolean
}

const MIN_HEIGHT = 54
const MAX_HEIGHT = 111
const HEIGHT_THRESHOLD = 75

export default function Chatbar({
    value,
    onChange,
    onSubmit,
    isLoading = false,
    onFileUpload,
    fileUploadState,
    isInChatPage = false,
    isCentered = false,
}: ChatbarProps) {
    // Use local state to track file only, not message
    const [file, setFile] = React.useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [isSubmitted, setIsSubmitted] = React.useState(false)
    const [isAnimating, setIsAnimating] = React.useState(false)

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: MIN_HEIGHT,
        maxHeight: MAX_HEIGHT,
    })

    // Add debug wrapper function
    const debugLog = (message: string, data: any) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Chatbar] ${message}:`, data)
        }
    }

    // Initialize with MAX_HEIGHT and track previous height
    const [textareaHeight, setTextareaHeight] = React.useState(MAX_HEIGHT)
    const [isTextareaMinHeight, setIsTextareaMinHeight] = React.useState(false)
    const previousHeightRef = React.useRef(MAX_HEIGHT)
    const heightCheckTimeoutRef = React.useRef<NodeJS.Timeout>()

    // Debounced height check
    const checkAndUpdateHeight = React.useCallback(() => {
        if (heightCheckTimeoutRef.current) {
            clearTimeout(heightCheckTimeoutRef.current)
        }

        heightCheckTimeoutRef.current = setTimeout(() => {
            if (textareaRef.current) {
                const currentHeight = textareaRef.current.offsetHeight
                // Check if height is at MIN_HEIGHT
                const isMinHeight = currentHeight === MIN_HEIGHT

                debugLog('Height Values', {
                    currentHeight,
                    MIN_HEIGHT,
                    MAX_HEIGHT,
                    isMinHeight,
                    hasFile: !!file,
                })

                if (file) {
                    setTextareaHeight(MAX_HEIGHT)
                    setIsTextareaMinHeight(isMinHeight) // Use the actual calculation
                    previousHeightRef.current = MAX_HEIGHT
                    return
                }

                setTextareaHeight(currentHeight)
                setIsTextareaMinHeight(isMinHeight)
                previousHeightRef.current = currentHeight
            }
        }, 100)
    }, [file])

    // Cleanup
    React.useEffect(() => {
        return () => {
            if (heightCheckTimeoutRef.current) {
                clearTimeout(heightCheckTimeoutRef.current)
            }
        }
    }, [])

    // Monitor height changes with ResizeObserver
    useEffect(() => {
        if (textareaRef.current) {
            debugLog('Initial Mount', {
                height: textareaRef.current.offsetHeight,
                ref: textareaRef.current,
            })

            // Initial height check
            checkAndUpdateHeight()

            const resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(checkAndUpdateHeight)
            })

            resizeObserver.observe(textareaRef.current)

            return () => {
                if (textareaRef.current) {
                    resizeObserver.unobserve(textareaRef.current)
                }
            }
        }
    }, [checkAndUpdateHeight])

    // Track file changes
    useEffect(() => {
        if (file) {
            debugLog('File Changed', { file })
            // Force a single height check after file change
            setTimeout(checkAndUpdateHeight, 0)
        }
    }, [file, checkAndUpdateHeight])

    const handleRemoveFile = React.useCallback((e?: React.MouseEvent) => {
        e?.preventDefault()
        e?.stopPropagation()
        setFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)

            if (textareaRef.current) {
                const currentHeight = textareaRef.current.offsetHeight
                textareaRef.current.style.height = `${MAX_HEIGHT}px`
                setTextareaHeight(MAX_HEIGHT)
                setIsTextareaMinHeight(currentHeight === MIN_HEIGHT) // Use actual height check
                previousHeightRef.current = MAX_HEIGHT
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!isLoading && (value.trim() || file)) {
            setIsSubmitted(true)
            setIsAnimating(true)

            if (onFileUpload && file) {
                onFileUpload(file)
            }

            try {
                await onSubmit(e, value, file || undefined)
                // Clear the file after successful submission
                handleRemoveFile()
                // Let parent component handle clearing the message
                adjustHeight(true)
            } catch (error) {
                console.error('Failed to send message:', error)
            } finally {
                setIsSubmitted(false)
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!isLoading && (value.trim() || file)) {
                handleSubmit(e as any)
            }
        }
    }

    const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value)
        adjustHeight()

        // Defer height check to next frame to ensure DOM updates
        requestAnimationFrame(() => {
            checkAndUpdateHeight()
            debugLog('Message Changed', {
                value: e.target.value,
                height: textareaRef.current?.offsetHeight,
            })
        })
    }

    // Debug logging
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Chatbar] State Update:', {
                height: textareaRef.current?.offsetHeight,
                isMinHeight: isTextareaMinHeight,
                timestamp: new Date().toISOString(),
            })
        }
    }, [isTextareaMinHeight])

    // Add handleFileError function
    const handleFileError = React.useCallback((error: string) => {
        if (process.env.NODE_ENV === 'development') {
            console.error('[Chatbar] File Error:', error)
        }
        // You can add additional error handling here if needed
        // For example, showing a toast notification
    }, [])

    return (
        <motion.div
            className="p-4 w-full absolute bg-background dark:bg-dark-app"
            style={{
                bottom: isInChatPage ? 0 : '40vh',
            }}
            animate={{
                bottom: isInChatPage ? 0 : isSubmitted ? 0 : '40vh',
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
            <form
                onSubmit={handleSubmit}
                className="flex relative flex-col gap-4 max-w-[800px] mx-auto"
            >
                {file && (
                    <div
                        className="relative"
                        style={{ height: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <FilePreview
                            file={file}
                            onRemove={handleRemoveFile}
                            isMinHeight={isTextareaMinHeight}
                            onError={handleFileError}
                            textareaHeight={textareaHeight}
                        />
                    </div>
                )}

                <div className="relative flex items-center">
                    <Textarea
                        value={value}
                        ref={textareaRef}
                        onChange={handleMessageChange}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            file
                                ? 'File attached. Add a message or press Send.'
                                : 'Type your message...'
                        }
                        className={cn(
                            'w-full resize-none rounded-lg pr-24 py-4',
                            'focus-visible:ring-1 focus-visible:ring-offset-0',
                            'scrollbar-thumb-rounded scrollbar-track-rounded',
                            'scrollbar-thin scrollbar-thumb-border',
                            'dark:bg-dark-app dark:text-dark-text dark:border-dark-border'
                        )}
                        style={{
                            minHeight: isInChatPage
                                ? '54px'
                                : isAnimating
                                  ? '54px'
                                  : `${MIN_HEIGHT}px`,
                            maxHeight: isInChatPage
                                ? '54px'
                                : isAnimating
                                  ? '54px'
                                  : `${MAX_HEIGHT}px`,
                            height: `${textareaHeight}px`, // Explicitly set height
                            transition: 'all 0.3s ease-in-out',
                        }}
                        disabled={isLoading}
                        onFocus={() => checkAndUpdateHeight()} // Check height on focus
                        onBlur={() => checkAndUpdateHeight()} // Check height on blur
                    />

                    <motion.div
                        className="absolute flex justify-between pl-4 bottom-2 right-2 gap-2"
                        animate={{
                            width: isInChatPage
                                ? '100px'
                                : isAnimating
                                  ? '100px'
                                  : '100%',
                        }}
                        transition={{
                            duration: 0.3,
                            ease: 'easeInOut',
                        }}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                            accept=".csv"
                        />

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 bg-secondary dark:bg-dark-app dark:text-dark-text dark:hover:bg-dark-border"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            <PaperclipIcon
                                className={cn(
                                    'h-5 w-5',
                                    isCentered && 'h-6 w-6'
                                )}
                            />
                        </Button>

                        <Button
                            type="submit"
                            size="icon"
                            className={cn(
                                'h-9 w-9',
                                'bg-gradient-to-tr from-[#FFDE56] to-[#4989BB]',
                                'dark:from-[#03f241] dark:via-[#d549dd] dark:to-[#03e5f2]',
                                'disabled:bg-none disabled:bg-[#F5F5F5] disabled:border disabled:border-[#D4D4D4]',
                                'dark:disabled:bg-dark-app dark:disabled:border-dark-border',
                                isCentered && 'h-11 w-11'
                            )}
                            disabled={isLoading || (!value.trim() && !file)}
                        >
                            {isLoading ? (
                                <Loader2
                                    className={cn(
                                        'h-5 w-5 animate-spin text-black dark:text-dark-text',
                                        isCentered && 'h-6 w-6'
                                    )}
                                />
                            ) : (
                                <ArrowUp
                                    className={cn(
                                        'h-5 w-5',
                                        'text-black dark:text-dark-text',
                                        'disabled:text-[#D4D4D4] dark:disabled:text-dark-border'
                                    )}
                                />
                            )}
                        </Button>
                    </motion.div>
                </div>
            </form>
        </motion.div>
    )
}

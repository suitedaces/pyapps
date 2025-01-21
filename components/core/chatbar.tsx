'use client'

import { useAutoResizeTextarea } from '@/components/hooks/use-auto-resize-textarea'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ArrowUp, Loader2, PaperclipIcon } from 'lucide-react'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { FileSelector } from '@/components/FileSelector'
import { useAuth } from '@/contexts/AuthContext'

interface ChatbarProps {
    value: string
    onChange: (value: string) => void
    onSubmit: (
        e: React.FormEvent,
        message: string,
        file?: File,
        fileId?: string
    ) => Promise<void>
    isLoading?: boolean
    fileUploadState?: {
        isUploading: boolean
        progress: number
        error: string | null
    }
    isInChatPage?: boolean
    isCentered?: boolean
    chatId?: string
    selectedFileIds?: string[]
    onFileSelect?: (fileIds: string[]) => void
}

const MIN_HEIGHT = 54
const MAX_HEIGHT = 111
const HEIGHT_THRESHOLD = 75

export default function Chatbar({
    value,
    onChange,
    onSubmit,
    isLoading = false,
    fileUploadState,
    isInChatPage = false,
    isCentered = false,
    chatId,
    selectedFileIds = [],
    onFileSelect,
}: ChatbarProps): JSX.Element {
    const { session, showAuthPrompt } = useAuth()
    // Use local state to track file only, not message
    const [file, setFile] = React.useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [isSubmitted, setIsSubmitted] = React.useState(false)
    const [isAnimating, setIsAnimating] = React.useState(false)
    const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setIsUploading(true)
            if (fileUploadState) {
                fileUploadState.isUploading = true
                fileUploadState.progress = 0
            }

            try {
                // Step 1: Check for existing file and initialize upload
                const initResponse = await fetch('/api/files', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fileName: selectedFile.name,
                        fileType: selectedFile.name.split('.').pop() || 'txt',
                        fileSize: selectedFile.size,
                        chatId: chatId,
                        overwrite: true // Signal that we want to overwrite
                    }),
                })

                if (!initResponse.ok) throw new Error('Failed to initialize upload')
                const { uploadId, key, fileId, existingFileId } = await initResponse.json()

                // Step 2: Upload file in chunks
                const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks
                const chunks = Math.ceil(selectedFile.size / CHUNK_SIZE)
                const parts = []

                for (let partNumber = 1; partNumber <= chunks; partNumber++) {
                    const start = (partNumber - 1) * CHUNK_SIZE
                    const end = Math.min(start + CHUNK_SIZE, selectedFile.size)
                    const chunk = selectedFile.slice(start, end)

                    const formData = new FormData()
                    formData.append('uploadId', uploadId)
                    formData.append('partNumber', partNumber.toString())
                    formData.append('key', key)
                    formData.append('file', chunk)

                    const partResponse = await fetch('/api/files', {
                        method: 'POST',
                        body: formData,
                    })

                    if (!partResponse.ok) throw new Error('Failed to upload part')
                    const { ETag } = await partResponse.json()
                    parts.push({ PartNumber: partNumber, ETag })

                    // Update progress
                    const progress = (partNumber / chunks) * 100
                    if (fileUploadState) {
                        fileUploadState.progress = progress
                        fileUploadState.isUploading = true
                    }
                    onChange(`Uploading ${selectedFile.name} (${Math.round(progress)}%)`)
                }

                // Show metadata generation message
                if (fileUploadState) {
                    fileUploadState.progress = 100
                }
                onChange('Generating file metadata...')

                // Step 3: Complete upload
                const completeResponse = await fetch('/api/files', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        uploadId,
                        key,
                        parts,
                        fileId,
                        existingFileId
                    }),
                })

                if (!completeResponse.ok) throw new Error('Failed to complete upload')
                setUploadedFileId(fileId)
                onChange('')

                // Update file selection - replace old file ID with new one if it existed
                if (onFileSelect) {
                    const newFileIds = [...selectedFileIds]
                    if (existingFileId) {
                        const index = newFileIds.indexOf(existingFileId)
                        if (index !== -1) {
                            newFileIds[index] = fileId
                        } else {
                            newFileIds.push(fileId)
                        }
                    } else {
                        newFileIds.push(fileId)
                    }
                    onFileSelect(newFileIds)
                }

                // Update chat associations if needed
                if (chatId) {
                    await fetch(`/api/chats/${chatId}/files`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            oldFileId: existingFileId,
                            newFileId: fileId
                        }),
                    })
                }

                // Automatically trigger file upload completion
                await onSubmit(new Event('submit') as any, '', selectedFile, fileId)
                handleRemoveFile()
                setUploadedFileId(null)

                if (textareaRef.current) {
                    const currentHeight = textareaRef.current.offsetHeight
                    textareaRef.current.style.height = `${MAX_HEIGHT}px`
                    setTextareaHeight(MAX_HEIGHT)
                    setIsTextareaMinHeight(currentHeight === MIN_HEIGHT)
                    previousHeightRef.current = MAX_HEIGHT
                }
            } catch (error) {
                console.error('Upload failed:', error)
                handleRemoveFile()
                onChange('')
                if (handleFileError) {
                    handleFileError('Failed to upload file. Please try again.')
                }
                if (fileUploadState) {
                    fileUploadState.error = 'Upload failed'
                }
            } finally {
                setIsUploading(false)
                if (fileUploadState) {
                    fileUploadState.isUploading = false
                    fileUploadState.progress = 0
                }
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isLoading || isUploading) return

        setIsSubmitted(true)
        setIsAnimating(true)

        try {
            if (file && uploadedFileId) {
                // File submission
                await onSubmit(e, '', file, uploadedFileId)
                handleRemoveFile()
                setUploadedFileId(null)
            } else if (value.trim()) {
                // Normal message submission
                await onSubmit(e, value)
            }
            adjustHeight(true)
        } catch (error) {
            console.error('Failed to send message:', error)
        } finally {
            setIsSubmitted(false)
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

    // Add handleFileError function
    const handleFileError = React.useCallback((error: string) => {
        if (process.env.NODE_ENV === 'development') {
            console.error('[Chatbar] File Error:', error)
        }
        // You can add additional error handling here if needed
        // For example, showing a toast notification
    }, [])

    // Load initial selected files
    useEffect(() => {
        const loadSelectedFiles = async () => {
            if (!chatId) return
            try {
                const response = await fetch(`/api/chats/${chatId}/files`)
                if (!response.ok) throw new Error('Failed to fetch files')
                const files = await response.json()
                onFileSelect?.(files.map((f: any) => f.id))
            } catch (error) {
                console.error('Error loading selected files:', error)
            }
        }

        if (chatId) {
            loadSelectedFiles()
        }
    }, [chatId, onFileSelect])

    const handleFileSelect = async (fileIds: string[]) => {
        onFileSelect?.(fileIds)
    }

    const handlePaperclipClick = () => {
        if (!session) {
            showAuthPrompt()
            return
        }
        fileInputRef.current?.click()
    }

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
                <div className="relative flex items-center">
                    {isUploading && (
                        <div className="absolute inset-x-0 -top-1">
                            <div className="relative h-1 bg-gray-100 dark:bg-gray-800 rounded-t-lg overflow-hidden">
                                <div 
                                    className="absolute inset-y-0 left-0 bg-green-400 dark:bg-green-500 transition-all duration-300 ease-out"
                                    style={{ width: `${fileUploadState?.progress || 0}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <Textarea
                        value={value}
                        ref={textareaRef}
                        onChange={handleMessageChange}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            isUploading
                                ? `Uploading ${file?.name || 'file'} (${Math.round(fileUploadState?.progress || 0)}%)`
                                : file && uploadedFileId
                                    ? 'Press Enter to start project with file!'
                                    : 'Type your message...'
                        }
                        className={cn(
                            'w-full resize-none rounded-lg pr-24 py-4',
                            'focus-visible:ring-1 focus-visible:ring-offset-0',
                            'scrollbar-thumb-rounded scrollbar-track-rounded',
                            'scrollbar-thin scrollbar-thumb-border',
                            'dark:bg-dark-app dark:text-dark-text dark:border-dark-border',
                            'transition-opacity duration-200',
                            isUploading && 'opacity-90'
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
                            height: `${textareaHeight}px`,
                            transition: 'all 0.3s ease-in-out',
                        }}
                        disabled={isLoading || isUploading || !!file}
                        onFocus={() => checkAndUpdateHeight()}
                        onBlur={() => checkAndUpdateHeight()}
                    />

                    <div className="absolute bottom-2 right-2">
                        <Button
                            type="submit"
                            size="icon"
                            className={cn(
                                'h-9 w-9',
                                'bg-gradient-to-tr from-[#FFDE56] to-[#4989BB]',
                                'dark:from-[#03f241] dark:via-[#d549dd] dark:to-[#03e5f2]',
                                'disabled:bg-none disabled:bg-[#F5F5F5] disabled:border disabled:border-[#D4D4D4]',
                                'dark:disabled:bg-dark-app dark:disabled:border-dark-border'
                            )}
                            disabled={
                                isLoading ||
                                isUploading ||
                                (!value.trim() && !file) ||
                                (!!file && !uploadedFileId)
                            }
                        >
                            {isLoading || isUploading ? (
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
                    </div>

                    <div className={cn(
                        "absolute bottom-2",
                        isInChatPage ? "right-14" : "left-4"
                    )}>
                        <motion.div
                            className="flex gap-2"
                            initial={false}
                            animate={{
                                x: (!isInChatPage && isAnimating) ? 'calc(100vw - 200px)' : 0
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
                                onClick={handlePaperclipClick}
                                disabled={isLoading || isUploading}
                            >
                                <PaperclipIcon
                                    className={cn(
                                        'h-5 w-5',
                                        isCentered && 'h-6 w-6'
                                    )}
                                />
                            </Button>

                            <FileSelector
                                onFileSelect={handleFileSelect}
                                selectedFileIds={selectedFileIds}
                                chatId={chatId}
                            />
                        </motion.div>
                    </div>
                </div>
            </form>
        </motion.div>
    )
}

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { z } from 'zod'
import { ScrollArea } from './ui/scroll-area'
import { useFileStore } from '@/lib/stores/file-store'

// File validation schema
const FileValidationSchema = z.object({
    file: z
        .instanceof(File)
        .refine(
            (file) => {
                const validExtensions = ['.csv', '.json', '.txt']
                return validExtensions.some((ext) =>
                    file.name.toLowerCase().endsWith(ext)
                )
            },
            {
                message:
                    'Invalid file type. Please upload a CSV, JSON, or TXT file.',
            }
        )
        .refine((file) => file.size <= 50 * 1024 * 1024, {
            message: 'File size must be less than 50MB.',
        }),
})

interface FilePreviewProps {
    onError?: (error: string) => void
    isMinHeight: boolean
    textareaHeight: number
    isSubmitted?: boolean
}

export function FilePreview({
    onError,
    isMinHeight,
    textareaHeight,
    isSubmitted = false
}: FilePreviewProps) {
    const { 
        currentFile, 
        reset: resetFile,
        setError: setFileError,
        error: fileError 
    } = useFileStore()
    
    const [isVisible, setIsVisible] = useState(true)
    const [preview, setPreview] = useState<string>('')
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Use FileStore's error state
    const handleError = (errorMessage: string) => {
        setFileError(errorMessage)
        onError?.(errorMessage)
    }

    useEffect(() => {
        const validateAndLoadFile = async () => {
            if (!currentFile) return
            
            setIsLoading(true)
            setFileError(null)  // Reset error in FileStore

            try {
                await FileValidationSchema.parseAsync({ file: currentFile })
                const text = await readFileContent(currentFile)
                setPreview(text)
            } catch (err) {
                const errorMessage = err instanceof z.ZodError 
                    ? err.errors[0].message 
                    : 'Error loading file preview'
                handleError(errorMessage)
            } finally {
                setIsLoading(false)
            }
        }

        if (currentFile) {
            validateAndLoadFile()
        }
    }, [currentFile, setFileError, onError])

    useEffect(() => {
        if (isSubmitted) {
            setIsVisible(false)
        }
    }, [isSubmitted, isLoading])

    const readFileContent = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()

            reader.onload = (e) => {
                const content = e.target?.result as string

                // Basic content validation
                if (!content.trim()) {
                    reject(new Error('File appears to be empty'))
                    return
                }

                // For CSV files, validate structure with more lenient checks
                if (file.name.toLowerCase().endsWith('.csv')) {
                    const lines = content
                        .split('\n')
                        .filter((line) => line.trim())
                    if (lines.length < 1) {
                        reject(new Error('CSV file appears to be empty'))
                        return
                    }
                }

                // For JSON files, validate JSON structure
                if (file.name.toLowerCase().endsWith('.json')) {
                    try {
                        JSON.parse(content)
                    } catch {
                        reject(new Error('Invalid JSON format'))
                        return
                    }
                }

                resolve(content)
            }

            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsText(file)
        })
    }

    const isPreviewable = (file: File) => {
        const validExtensions = ['.csv', '.txt', '.json']
        return validExtensions.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
        )
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsVisible(false)
        resetFile()
    }

    // Simplified animation logic
    const getPosition = React.useMemo(() => {
        const isBottom = !isMinHeight

        return {
            initial: {
                opacity: 0,
                y: isBottom ? -20 : 20,
            },
            animate: {
                opacity: 1,
                y: 0,
                transition: {
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                    mass: 0.5,
                },
            },
            exit: {
                opacity: 0,
                y: isBottom ? -20 : 20,
                transition: { duration: 0.2 },
            },
        }
    }, [isMinHeight])

    // Debug logging
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[FilePreview] Position Update:', {
                isMinHeight,
                position: isMinHeight ? 'top' : 'bottom',
                height: isMinHeight ? 'min' : 'max',
                animation: getPosition,
                timestamp: new Date().toISOString(),
            })
        }
    }, [isMinHeight, getPosition])

    const handlePreviewClick = () => {
        if (currentFile && !fileError && isPreviewable(currentFile)) {
            setIsPreviewOpen(true)
        }
    }

    if (!currentFile) return null;

    return (
        <>
            <AnimatePresence mode="wait">
                {isVisible && (
                    <motion.div
                        {...getPosition}
                        className={cn(
                            'absolute w-full bg-slate-50 dark:bg-slate-900 border-x',
                            !isMinHeight
                                ? 'top-[130px] translate-y-full border-b rounded-b-xl' // Top position
                                : 'bottom-0 -mb-5 -translate-y-full border-t rounded-t-xl', // Bottom position
                            'transform transition-transform duration-200'
                        )}
                    >
                        <div className="p-2">
                            <motion.div
                                className={`relative bg-white dark:bg-slate-800 rounded-lg border p-3 w-44 cursor-pointer
                                    ${fileError ? 'border-red-500' : 'hover:border-primary/50'} transition-colors`}
                                onClick={handlePreviewClick}
                                whileHover={{ scale: fileError ? 1 : 1.02 }}
                                whileTap={{ scale: fileError ? 1 : 0.98 }}
                            >
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleRemove}
                                    className="absolute -right-1.5 -top-1.5 p-1 rounded-full bg-white dark:bg-slate-800 border shadow-sm text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </motion.button>

                                <div className="flex flex-col items-center gap-1.5">
                                    <div className="text-center">
                                        <span className="text-sm dark:text-white font-medium line-clamp-2 text-center">
                                            {currentFile.name}
                                        </span>
                                    </div>

                                    <span className="text-xs text-muted-foreground">
                                        {Math.round(currentFile.size / 1024)}KB
                                    </span>

                                    {fileError ? (
                                        <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-1 rounded w-full text-center">
                                            {fileError}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded w-full text-center">
                                            {currentFile.name
                                                .split('.')
                                                .pop()
                                                ?.toUpperCase() || 'FILE'}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl h-[80vh] absolute bottom-0 text-black">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>Preview:</span>
                            <span className="font-normal text-muted-foreground">
                                {currentFile.name}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 h-[calc(80vh-100px)] mt-4 border rounded-md bg-slate-100">
                        <div className="p-4">
                            {isLoading ? (
                                <div className="text-center text-muted-foreground">
                                    Loading preview...
                                </div>
                            ) : fileError ? (
                                <div className="text-center text-red-500">
                                    {fileError}
                                </div>
                            ) : (
                                <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                                    {preview}
                                </pre>
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    )
}

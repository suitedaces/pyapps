import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { z } from 'zod'
import { ScrollArea } from './ui/scroll-area'
import { cn } from '@/lib/utils'

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
        .refine((file) => file.size <= 5 * 1024 * 1024, {
            message: 'File size must be less than 5MB.',
        }),
})

interface FilePreviewProps {
    file: File
    onRemove: () => void
    onError?: (error: string) => void
    isMinHeight: boolean
}

export function FilePreview({ file, onRemove, onError, isMinHeight }: FilePreviewProps) {
    const [isVisible, setIsVisible] = useState(true)
    const [preview, setPreview] = useState<string>('')
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const validateAndLoadFile = async () => {
            setIsLoading(true)
            setError(null)

            try {
                // Validate file
                await FileValidationSchema.parseAsync({ file })

                // Read file content
                const text = await readFileContent(file)
                setPreview(text)
            } catch (err) {
                const errorMessage =
                    err instanceof z.ZodError
                        ? err.errors[0].message
                        : 'Error loading file preview'
                setError(errorMessage)
                onError?.(errorMessage)
            } finally {
                setIsLoading(false)
            }
        }

        if (file) {
            validateAndLoadFile()
        }
    }, [file, onError])

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
        onRemove()
    }

    // Simplified animation logic
    const getPosition = React.useMemo(() => {
        const isBottom = !isMinHeight

        return {
            initial: {
                opacity: 0,
                y: isBottom ? 20 : -20
            },
            animate: {
                opacity: 1,
                y: 0,
                transition: {
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    mass: 0.5
                }
            },
            exit: {
                opacity: 0,
                y: isBottom ? 20 : -20,
                transition: { duration: 0.2 }
            }
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
                timestamp: new Date().toISOString()
            })
        }
    }, [isMinHeight, getPosition])

    return (
        <>
            <AnimatePresence mode="wait">
                {isVisible && (
                    <motion.div
                        {...getPosition}
                        className={cn(
                            "absolute w-full bg-slate-50 dark:bg-slate-900 border-x",
                            isMinHeight
                                ? "top-0 -translate-y-full border-t rounded-t-xl"  // Top position
                                : "bottom-0 translate-y-full border-b rounded-b-xl", // Bottom position
                            "transform transition-transform duration-200"  // Smooth transform
                        )}
                    >
                        <div className="p-2">
                            <motion.div
                                className={`relative bg-white dark:bg-slate-800 rounded-lg border p-3 w-44 cursor-pointer
                                    ${error ? 'border-red-500' : 'hover:border-primary/50'} transition-colors`}
                                onClick={() =>
                                    isPreviewable(file) &&
                                    !error &&
                                    setIsPreviewOpen(true)
                                }
                                whileHover={{ scale: error ? 1 : 1.02 }}
                                whileTap={{ scale: error ? 1 : 0.98 }}
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
                                        <span className="text-sm font-medium line-clamp-2 text-center">
                                            {file.name}
                                        </span>
                                    </div>

                                    <span className="text-xs text-muted-foreground">
                                        {Math.round(file.size / 1024)}KB
                                    </span>

                                    {error ? (
                                        <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-1 rounded w-full text-center">
                                            {error}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded w-full text-center">
                                            {file.name
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
                                {file.name}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 h-[calc(80vh-100px)] mt-4 border rounded-md bg-slate-100">
                        <div className="p-4">
                            {isLoading ? (
                                <div className="text-center text-muted-foreground">
                                    Loading preview...
                                </div>
                            ) : error ? (
                                <div className="text-center text-red-500">
                                    {error}
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

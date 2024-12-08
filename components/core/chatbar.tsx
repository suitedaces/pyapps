'use client'

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PaperclipIcon, ArrowUp, Loader2 } from "lucide-react"
import { FilePreview } from "@/components/FilePreview"
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { motion, AnimatePresence } from "framer-motion"

interface ChatbarProps {
    onSubmit: (content: string, file?: File) => Promise<void>
    isLoading: boolean
    className?: string
    isCentered?: boolean
    isInChatPage?: boolean
}

const MIN_HEIGHT = 74;
const MAX_HEIGHT = 110;

export default function Chatbar({ onSubmit, isLoading, className, isCentered, isInChatPage }: ChatbarProps) {
    const [message, setMessage] = React.useState("")
    const [file, setFile] = React.useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [isSubmitted, setIsSubmitted] = React.useState(false)
    const [isAnimating, setIsAnimating] = React.useState(false)

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: MIN_HEIGHT,
        maxHeight: MAX_HEIGHT,
    });

    const handleRemoveFile = React.useCallback((e?: React.MouseEvent) => {
        // Prevent event bubbling
        e?.preventDefault();
        e?.stopPropagation();

        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (message.trim() || file) {
            setIsSubmitted(true)
            setIsAnimating(true)
            const currentMessage = message
            const currentFile = file

            // Clear form
            setMessage("")
            handleRemoveFile()
            adjustHeight(true);

            try {
                await onSubmit(currentMessage, currentFile || undefined)
            } catch (error) {
                console.error('Failed to send message:', error)
                setIsSubmitted(false)
                setMessage(currentMessage)
                setFile(currentFile)
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!isLoading && (message.trim() || file)) {
                handleSubmit(e as any)
            }
        }
    }

    return (
        <motion.div
            className="p-4 w-full absolute bg-background dark:bg-dark-app"
            style={{
                bottom: isInChatPage ? 0 : "40vh"
            }}
            animate={{
                bottom: isInChatPage ? 0 : (isSubmitted ? 0 : "40vh")
            }}
            transition={{
                duration: 0.3,
                ease: "easeInOut"
            }}
        >
            <form onSubmit={handleSubmit} className="flex relative flex-col gap-4 max-w-[800px] mx-auto">
                {file && (
                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                        <FilePreview file={file} onRemove={handleRemoveFile} />
                    </div>
                )}

                <div className="relative flex items-center">
                    <Textarea
                        value={message}
                        ref={textareaRef}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={file ? 'File attached. Add a message or press Send.' : 'Type your message...'}
                        className={cn(
                            "w-full resize-none rounded-lg pr-24 py-4",
                            "focus-visible:ring-1 focus-visible:ring-offset-0",
                            "scrollbar-thumb-rounded scrollbar-track-rounded",
                            "scrollbar-thin scrollbar-thumb-border",
                            "dark:bg-dark-app dark:text-dark-text dark:border-dark-border"
                        )}
                        style={{
                            minHeight: isInChatPage ? '54px' : isAnimating ? '54px' : `${MIN_HEIGHT}px`,
                            maxHeight: isInChatPage ? '54px' : isAnimating ? '54px' : `${MAX_HEIGHT}px`,
                            transition: 'min-height 0.3s ease-in-out, max-height 0.3s ease-in-out'
                        }}
                        disabled={isLoading}
                    />

                    <motion.div
                        className="absolute flex justify-between pl-4 bottom-2 right-2 gap-2"
                        animate={{
                            width: isInChatPage ? '100px' : isAnimating ? '100px' : '100%'
                        }}
                        transition={{
                            duration: 0.3,
                            ease: "easeInOut"
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
                            <PaperclipIcon className={cn(
                                "h-5 w-5",
                                isCentered && "h-6 w-6"
                            )} />
                        </Button>

                        <Button
                            type="submit"
                            size="icon"
                            className={cn(
                                "h-9 w-9",
                                "bg-gradient-to-tr from-[#FFDE56] to-[#4989BB]",
                                "dark:from-[#03f241] dark:via-[#d549dd] dark:to-[#03e5f2]",
                                "disabled:bg-none disabled:bg-[#F5F5F5] disabled:border disabled:border-[#D4D4D4]",
                                "dark:disabled:bg-dark-app dark:disabled:border-dark-border",
                                isCentered && "h-11 w-11"
                            )}
                            disabled={isLoading || (!message.trim() && !file)}
                        >
                            {isLoading ? (
                                <Loader2 className={cn(
                                    "h-5 w-5 animate-spin text-black dark:text-dark-text",
                                    isCentered && "h-6 w-6"
                                )} />
                            ) : (
                                <ArrowUp className={cn(
                                    "h-5 w-5",
                                    "text-black dark:text-dark-text",
                                    "disabled:text-[#D4D4D4] dark:disabled:text-dark-border"
                                )} />
                            )}
                        </Button>
                    </motion.div>
                </div>
            </form>
        </motion.div>
    )
}

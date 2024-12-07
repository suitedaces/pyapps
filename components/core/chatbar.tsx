'use client'

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PaperclipIcon, ArrowUp, Loader2 } from "lucide-react"
import { FilePreview } from "@/components/FilePreview"
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { motion } from "framer-motion"

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
            className="p-4 w-full absolute bg-background"
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
                            "min-h-[110px] w-full resize-none rounded-lg pr-24 py-4",
                            "focus-visible:ring-1 focus-visible:ring-offset-0",
                            "scrollbar-thumb-rounded scrollbar-track-rounded",
                            "scrollbar-thin scrollbar-thumb-border"
                        )}
                        disabled={isLoading}
                    />

                    <div className="absolute w-full flex justify-between px-2 bottom-2 gap-2">
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
                            className="h-9 w-9 bg-secondary"
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
                                isCentered && "h-11 w-11"
                            )}
                            disabled={isLoading || (!message.trim() && !file)}
                        >
                            {isLoading ? (
                                <Loader2 className={cn(
                                    "h-5 w-5 animate-spin",
                                    isCentered && "h-6 w-6"
                                )} />
                            ) : (
                                <ArrowUp className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </motion.div>
    )
}

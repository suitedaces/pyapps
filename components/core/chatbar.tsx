"use client";

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PaperclipIcon, SendIcon, Loader2 } from "lucide-react"
import { FilePreview } from "@/components/FilePreview"

interface ChatbarProps {
    onSubmit: (content: string, file?: File) => Promise<void>
    isLoading: boolean
}

export default function Chatbar({ onSubmit, isLoading }: ChatbarProps) {
    const [message, setMessage] = React.useState("")
    const [file, setFile] = React.useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const handleRemoveFile = React.useCallback(() => {
        setFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (message.trim() || file) {
            // Store current values before clearing
            const currentMessage = message
            const currentFile = file

            // Clear form
            setMessage("")
            handleRemoveFile()

            try {
                await onSubmit(currentMessage, currentFile || undefined)
            } catch (error) {
                console.error("Failed to send message:", error)
                // Optionally restore values on err
                setMessage(currentMessage)
                setFile(currentFile)
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            if (!isLoading && (message.trim() || file)) {
                handleSubmit(e as any)
            }
        }
    }

    return (
        <div className="p-4 border-t bg-background">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-[800px] mx-auto">
                {file && (
                    <FilePreview
                        file={file}
                        onRemove={handleRemoveFile}
                    />
                )}

                <div className="relative flex items-center">
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className={cn(
                            "min-h-[56px] w-full resize-none rounded-lg pr-24 py-4",
                            "focus-visible:ring-1 focus-visible:ring-offset-0",
                            "scrollbar-thumb-rounded scrollbar-track-rounded",
                            "scrollbar-thin scrollbar-thumb-border"
                        )}
                        disabled={isLoading}
                    />

                    <div className="absolute right-2 flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            <PaperclipIcon className="h-5 w-5" />
                        </Button>

                        <Button
                            type="submit"
                            size="icon"
                            className="h-9 w-9"
                            disabled={isLoading || (!message.trim() && !file)}
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <SendIcon className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}

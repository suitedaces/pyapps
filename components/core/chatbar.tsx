'use client'

import { FilePreview } from '@/components/FilePreview'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Loader2, PaperclipIcon, SendIcon } from 'lucide-react'
import * as React from 'react'

interface ChatbarProps {
    onSubmit: (content: string, file?: File) => Promise<void>
    isLoading: boolean
    className?: string
    isCentered?: boolean
}

export default function Chatbar({ 
    onSubmit, 
    isLoading, 
    className,
    isCentered = false 
}: ChatbarProps) {
    const [message, setMessage] = React.useState('')
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
            setMessage('')
            handleRemoveFile()

            try {
                await onSubmit(currentMessage, currentFile || undefined)
            } catch (error) {
                console.error('Failed to send message:', error)
                // Optionally restore values on err
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
        <div className={className}>
            <form
                onSubmit={handleSubmit}
                className={cn(
                    "flex flex-col gap-2",
                    "mx-auto",
                    isCentered ? "max-w-[100%]" : "max-w-[800px]"
                )}
            >
                {file && (
                    <div className="mb-2">
                        <FilePreview file={file} onRemove={handleRemoveFile} />
                    </div>
                )}

                <div className="relative flex items-center">
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className={cn(
                            'w-full resize-none rounded-lg pr-24',
                            'focus-visible:ring-1 focus-visible:ring-offset-0',
                            'scrollbar-thumb-rounded scrollbar-track-rounded',
                            'scrollbar-thin scrollbar-thumb-border',
                            'max-h-[120px]',
                            isCentered ? 'min-h-[80px] py-6 text-lg' : 'min-h-[56px] py-4'
                        )}
                        disabled={isLoading}
                    />

                    <div className={cn(
                        "absolute right-2 flex items-center gap-2",
                        isCentered && "right-4 gap-3"
                    )}>
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
                            className={cn(
                                "h-9 w-9",
                                isCentered && "h-11 w-11"
                            )}
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
                                <SendIcon className={cn(
                                    "h-5 w-5",
                                    isCentered && "h-6 w-6"
                                )} />
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}

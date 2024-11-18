"use client";

import { CornerRightUp, FileUp, Paperclip, X, Loader2 } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useFileInput } from "@/hooks/use-file-input";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { FilePreview } from '@/components/FilePreview';

const MIN_HEIGHT = 52;

interface SimpleChatbarProps {
  onSubmit?: (content: string, file?: File) => Promise<void>;
  isLoading?: boolean;
}

export default function SimpleChatbar({ onSubmit, isLoading = false }: SimpleChatbarProps) {
    const [inputValue, setInputValue] = useState<string>("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: MIN_HEIGHT,
        maxHeight: 200,
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setFileError(null);
        }
    };

    const handleRemoveFile = useCallback(() => {
        setSelectedFile(null);
        setFileError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const resetForm = useCallback(() => {
        setInputValue("");
        handleRemoveFile();
        adjustHeight(true);
    }, [handleRemoveFile, adjustHeight]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() && !selectedFile) return;

        try {
            await onSubmit?.(inputValue, selectedFile || undefined);
            resetForm();
        } catch (error) {
            console.error('Submit error:', error);
            setFileError(error instanceof Error ? error.message : 'Failed to submit');
        }
    };

    const LoadingAnimation = () => (
        <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
        </div>
    );

    return (
        <div className="w-full py-2 sm:py-4 px-2 sm:px-0">
            <div className="relative max-w-xl w-full mx-auto flex flex-col gap-2">
                {selectedFile && !isLoading && (
                    <FilePreview
                        file={selectedFile}
                        onRemove={handleRemoveFile}
                        onError={setFileError}
                    />
                )}

                <form onSubmit={handleSubmit} className="relative items-center">
                    <div
                        className={cn(
                            "absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 sm:h-8 w-7 sm:w-8 rounded-lg",
                            "hover:cursor-pointer bg-black/5 dark:bg-white/5",
                            fileError ? "bg-red-100 dark:bg-red-900/20" : "",
                            isLoading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <label className="w-full h-full flex items-center justify-center cursor-pointer">
                            <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept=".csv,.json,.txt"
                                disabled={isLoading}
                            />
                            <Paperclip
                                className={cn(
                                    "w-3.5 sm:w-4 h-3.5 sm:h-4 transition-opacity transform scale-x-[-1] rotate-45",
                                    "dark:text-white",
                                    fileError ? "text-red-500 dark:text-red-400" : ""
                                )}
                            />
                        </label>
                    </div>

                    <Textarea
                        id="ai-input-02"
                        placeholder={fileError || (selectedFile ? "Add a message or press Enter to send file" : "File Upload and Chat!")}
                        className={cn(
                            "max-w-xl w-full rounded-2xl sm:rounded-3xl pl-10 sm:pl-12 pr-12 sm:pr-16",
                            "placeholder:text-muted-foreground",
                            "border border-input",
                            "text-foreground",
                            "text-sm sm:text-base",
                            "max-h-[200px] overflow-y-auto resize-none leading-[1.2]",
                            `min-h-[${MIN_HEIGHT}px]`,
                            "bg-background",
                            fileError ? "placeholder:text-red-500 dark:placeholder:text-red-400" : "",
                            isLoading && "opacity-50"
                        )}
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            adjustHeight();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        disabled={isLoading}
                    />

                    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2">
                        {isLoading ? (
                            <LoadingAnimation />
                        ) : (
                            <button
                                type="submit"
                                className={cn(
                                    "rounded-xl py-1 px-1",
                                    "bg-primary text-primary-foreground hover:bg-primary/90",
                                    "transition-all duration-200",
                                    fileError ? "bg-red-100 dark:bg-red-900/20" : "",
                                    (!inputValue.trim() && !selectedFile) && "opacity-50 cursor-not-allowed"
                                )}
                                disabled={isLoading || (!inputValue.trim() && !selectedFile) || !!fileError}
                            >
                                <CornerRightUp
                                    className={cn(
                                        "w-3.5 sm:w-4 h-3.5 sm:h-4 transition-opacity dark:text-white",
                                        (inputValue || selectedFile) && !fileError ? "opacity-100" : "opacity-30",
                                        fileError ? "text-red-500 dark:text-red-400" : ""
                                    )}
                                />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

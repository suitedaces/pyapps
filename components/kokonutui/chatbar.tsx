"use client";

import {
    ArrowRight,
    Brain,
    type LucideIcon,
    Mic,
    Paperclip,
    TriangleAlert,
    Loader2,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/components/kokonutui/use-auto-resize-textarea";
import { FilePreview } from "@/components/FilePreview";

interface ToolbarButton {
    icon: LucideIcon;
    onClick?: () => void;
    className: string | ((isRecording: boolean) => string);
    isFileInput?: boolean;
    isRecording?: boolean;
}

const MIN_HEIGHT = 128;

interface ChatBarProps {
    handleSubmit: (content: string, file?: File) => Promise<void>;
    isLoading: boolean;
}

export default function ChatBar({ handleSubmit, isLoading }: ChatBarProps) {
    const [value, setValue] = useState("");
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: MIN_HEIGHT,
        maxHeight: 200,
    });
    const [useMemory, setUseMemory] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const AI_MODELS = ["GPT-4", "Claude", "Gemini"];

    const TOOLBAR_BUTTONS: ToolbarButton[] = [
        {
            icon: Mic,
            onClick: () => setIsRecording(!isRecording),
            className: (isRecording: boolean) =>
                cn(
                    "rounded-lg p-2 transition-all",
                    isRecording
                        ? "bg-red-500 text-white"
                        : "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                ),
            isRecording,
        },
        {
            icon: Paperclip,
            isFileInput: true,
            className: "rounded-lg p-2 bg-black/5 dark:bg-white/5",
        },
    ];
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (value.trim() || selectedFile) {
            try {
                await handleSubmit(value, selectedFile || undefined);
                setValue("");
                setSelectedFile(null);
                adjustHeight(true);
            } catch (error) {
                console.error('Submit error:', error);
            }
        }
    }, [value, selectedFile, handleSubmit, adjustHeight]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && (value.trim() || selectedFile)) {
                onSubmit(e as any as React.FormEvent<HTMLFormElement>);
            }
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
    };

    return (
        <div className="w-[80%] max-w-[800px] m-auto py-4">
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <select className="text-xs bg-black/5 dark:bg-white/5 border border-neutral-200 border-black/10 dark:border-white/10 rounded-md px-2 py-1 dark:text-white dark:border-neutral-800">
                            {AI_MODELS.map((model) => (
                                <option key={model}>{model}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <form onSubmit={onSubmit} className="relative">
                    <Textarea
                        value={value}
                        placeholder={selectedFile ? "File attached. Click submit to send." : "Type your message..."}
                        ref={textareaRef}
                        onKeyDown={handleKeyDown}
                        onChange={(e) => {
                            setValue(e.target.value);
                            adjustHeight();
                        }}
                        disabled={isLoading}
                    />

                    <div className="absolute left-3 bottom-3 flex items-center gap-2">
                        {TOOLBAR_BUTTONS.map((button, index) =>
                            button.isFileInput ? (
                                <label
                                    key={index}
                                    className={cn(
                                        typeof button.className === "string"
                                            ? button.className
                                            : button.className(isRecording),
                                        isLoading && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        disabled={isLoading}
                                    />
                                    <button.icon className="w-4 h-4 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors" />
                                </label>
                            ) : (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={button.onClick}
                                    disabled={isLoading}
                                    className={
                                        typeof button.className === "string"
                                            ? button.className
                                            : button.className(isRecording)
                                    }
                                >
                                    <button.icon className="w-4 h-4" />
                                </button>
                            )
                        )}
                    </div>

                    <button
                        type="submit"
                        className={cn(
                            "absolute right-3 bottom-3 rounded-lg p-2",
                            isLoading ? "bg-gray-300 dark:bg-gray-700" : "bg-black/5 dark:bg-white/5",
                            (!value.trim() && !selectedFile) && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={isLoading || (!value.trim() && !selectedFile)}
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <ArrowRight
                                className={cn(
                                    "w-4 h-4 dark:text-white",
                                    (value.trim() || selectedFile) ? "opacity-100" : "opacity-30"
                                )}
                            />
                        )}
                    </button>
                </form>

                {selectedFile && !isLoading && (
                    <FilePreview
                        file={selectedFile}
                        onRemove={handleRemoveFile}
                    />
                )}

                <div className="mt-3 flex items-center gap-2 text-xs text-black/50 dark:text-white/50 justify-center">
                    <div className="flex items-center gap-1">
                        <TriangleAlert className="w-3 h-3" />
                        <span>AI can make mistakes, use with caution.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

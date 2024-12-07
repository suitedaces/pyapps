import { useEffect, useRef, useCallback } from "react";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

export function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            // Reset ke case mein minHeight set karenge
            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            // Normal case mein maxHeight set karenge
            if (maxHeight) {
                textarea.style.height = `${maxHeight}px`;
            } else {
                textarea.style.height = `${minHeight}px`;
            }
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        // Initial height set karo - by default maxHeight
        const textarea = textareaRef.current;
        if (textarea && maxHeight) {
            textarea.style.height = `${maxHeight}px`;
        } else if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight, maxHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

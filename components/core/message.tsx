"use client";

import { Message as AIMessage } from "ai";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Markdown, UserMarkdown } from "./markdown";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef, useState } from 'react';

interface MessageProps extends AIMessage {
  isLastMessage?: boolean;
}

export function Message({ role, content, id, isLastMessage = false }: MessageProps) {
    const isUser = role === "user";
    const { session } = useAuth();
    const user = session?.user;
    const bubbleRef = useRef<HTMLDivElement>(null);
    const [isShortBubble, setIsShortBubble] = useState(false);

    useEffect(() => {
        const checkBubbleHeight = () => {
            if (bubbleRef.current) {
                const height = bubbleRef.current.offsetHeight;
                setIsShortBubble(height < 100);
            }
        };

        checkBubbleHeight();

        const resizeObserver = new ResizeObserver(checkBubbleHeight);
        if (bubbleRef.current) {
            resizeObserver.observe(bubbleRef.current);
        }

        return () => resizeObserver.disconnect();
    }, [content]);

    return (
        <motion.div
            key={id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className={cn("flex w-full", isUser ? "justify-end" : "justify-start", "mb-4")}
        >
      {!isUser && (
                <div className="flex flex-row items-start w-full">
                    <Avatar className="w-8 h-8 bg-[#FFD700] border-2 mt-5 border-border flex-shrink-0">
                        <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <div className="mx-2 p-4 break-words overflow-hidden w-full">
                        <Markdown>{content}</Markdown>
                    </div>
                </div>
            )}

            {isUser && (
                <div className="max-w-[600px] w-full">
                    <div className="custom-bubble" ref={bubbleRef}>
                        <div className={cn("bubble-inner", isShortBubble && "short-bubble")}>
                            <div className="avatar-container ml-1">
                                <div className="avatar w-[40px] h-[40px]">
                                    <Avatar className="bg-blue-500 border-2 border-border rounded-xl">
                                        {user?.user_metadata?.avatar_url ? (
                                            <AvatarImage
                                                src={user.user_metadata.avatar_url}
                                                alt={user.user_metadata.full_name || "User"}
                                            />
                                        ) : (
                                            <AvatarFallback>
                                                {user?.user_metadata?.full_name?.[0]?.toUpperCase() ||
                                                    user?.email?.[0]?.toUpperCase() ||
                                                    "U"}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                </div>
                            </div>
                            <div className="message-content w-full">
                                <UserMarkdown>{content}</UserMarkdown>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
  );
}

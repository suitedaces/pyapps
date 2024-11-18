"use client";

import { Message as AIMessage } from "ai";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Markdown, UserMarkdown } from "./markdown";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface MessageProps extends AIMessage {
  isLastMessage?: boolean;
}

export function Message({ role, content, id, isLastMessage = false }: MessageProps) {
    const isUser = role === "user";
    const { session } = useAuth();
    const user = session?.user;

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
                <div className="flex flex-row items-start justify-end w-full">
                    <div className="mx-2 p-4 rounded-lg bg-background border border-border text-foreground break-words overflow-hidden text-right inline-block max-w-[600px]">
                        <UserMarkdown>{content}</UserMarkdown>
                    </div>
                    <Avatar className="w-8 h-8 bg-blue-500 border-2 border-border flex-shrink-0">
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
            )}
        </motion.div>
    );
}

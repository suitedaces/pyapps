"use client";

import { Message as AIMessage } from "ai";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Markdown } from "./markdown";

interface MessageProps extends AIMessage {
  isLastMessage?: boolean;
}

export function Message({ role, content, id, isLastMessage = false }: MessageProps) {
  const isUser = role === "user";

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`flex ${
          isUser ? "flex-row-reverse" : "flex-row"
        } items-start max-w-[80%]`}
      >
        <Avatar
          className={`w-8 h-8 ${
            isUser ? "bg-blue" : "bg-main"
          } border-2 border-border flex-shrink-0`}
        >
          <AvatarFallback>{isUser ? "U" : "A"}</AvatarFallback>
        </Avatar>

        <div
          className={`mx-2 p-4 ${
            isUser
              ? "rounded-base bg-bg border-2 border-border"
              : ""
          } break-words overflow-hidden`}
        >
          <Markdown>{content as string}</Markdown>
        </div>
      </div>
    </motion.div>
  );
}

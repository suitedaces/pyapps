import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Message } from "@/lib/types";
import { Paperclip, Send, Loader2, Code } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { CodeProps } from "react-markdown/lib/ast-to-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism";

export function Chat({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  streamingMessage,
  streamingCodeExplanation,
  handleFileUpload,
}: {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  streamingMessage: string;
  streamingCodeExplanation: string;
  handleFileUpload: (content: string, fileName: string) => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingMessage, streamingCodeExplanation, isAtBottom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setIsAtBottom(scrollHeight - scrollTop === clientHeight);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        handleFileUpload(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  const renderMessage = (content: string) => (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }: CodeProps) {
          const match = /language-(\w+)/.exec(className || "");
          const lang = match && match[1] ? match[1] : "";
          const codeString = String(children).replace(/\n$/, "");

          if (inline) {
            return (
              <code
                className="px-1 py-0.5 rounded-base bg-bg dark:bg-darkBg text-text dark:text-darkText text-sm font-mono"
                {...props}
              >
                {codeString}
              </code>
            );
          }

          return (
            <div className="rounded-base overflow-hidden bg-dark dark:bg-darkBg my-4 border-border border-2 dark:shadow-dark w-full">
              <div className="flex items-center justify-between px-4 py-2 bg-bg">
                <div className="flex items-center">
                  <Code className="w-5 h-5 mr-2 text-text dark:text-darkText" />
                  <span className="text-sm font-medium text-text dark:text-darkText">
                    {lang.toUpperCase() || "Code"}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <SyntaxHighlighter
                  style={tomorrow}
                  language={lang || "javascript"}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            </div>
          );
        },
        p: ({ children }) => <p className="mb-2 break-words">{children}</p>,
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mb-3">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-bold mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-bold mb-2">{children}</h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-6 mb-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-6 mb-2">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="mb-1">
            {React.Children.map(children, (child) =>
              typeof child === "string" ? <span>{child}</span> : child,
            )}
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-main pl-4 italic mb-2">
            {children}
          </blockquote>
        ),
      }}
      className="prose prose-invert max-w-none"
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="flex flex-col h-full dark:border-darkBorder rounded-3xl border-2 border-border bg-darkText dark:bg-darkBg text-text dark:text-darkText">
      <ScrollArea className="flex-grow p-4 space-y-4" onScroll={handleScroll}>
        {messages.map((message, index) => (
          // <div key={index} className={`flex justify-start mb-4`}>
          //     <div className={`flex flex-row items-start max-w-[80%]`}>
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}
          >
            <div
              className={`flex ${message.role === "user" ? "flex-row-reverse" : "flex-row"} items-start max-w-[80%]`}
            >
              <Avatar
                className={`w-8 h-8 ${message.role === "user" ? "bg-blue" : "bg-main"} border-2 border-border flex-shrink-0`}
              >
                <AvatarFallback>
                  {message.role === "user" ? "U" : "G"}
                </AvatarFallback>
              </Avatar>
              <div
                className={`mx-2 p-4 rounded-base ${
                  message.role === "assistant" ? "bg-main" : "bg-bg"
                } text-text dark:text-darkText border-2 border-border break-words overflow-hidden dark:shadow-dark transition-all duration-300 ease-in-out`}
              >
                {/* } text-text dark:text-darkText border-2 border-border break-words overflow-hidden shadow-light dark:shadow-dark transition-all duration-300 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none`}> */}
                {renderMessage(message.content)}
              </div>
            </div>
          </div>
        ))}
        {streamingMessage && (
          <div className="flex justify-start mb-4">
            <div className="flex flex-row items-start max-w-[80%]">
              <Avatar className="w-8 h-8 bg-main flex-shrink-0">
                <AvatarFallback>G</AvatarFallback>
              </Avatar>
              <div className="mx-2 p-4 rounded-base bg-main text-text dark:text-darkText break-words overflow-hidden shadow-light dark:shadow-dark transition-all duration-500 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none">
                {renderMessage(streamingMessage)}
              </div>
            </div>
          </div>
        )}
        {streamingCodeExplanation && (
          <div className="flex justify-start mb-4">
            <div className="flex flex-row items-start max-w-[80%]">
              <Avatar className="w-8 bg-main h-8 flex-shrink-0">
                <AvatarFallback>G</AvatarFallback>
              </Avatar>
              <div className="mx-2 p-4 rounded-base bg-main text-text dark:text-darkText break-words overflow-hidden shadow-light dark:shadow-dark transition-all duration-500 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none">
                {renderMessage(streamingCodeExplanation)}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>
      {!isAtBottom && (
        <Button
          onClick={() =>
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          }
          className="absolute bottom-20 right-8 bg-main hover:bg-mainAccent text-text dark:text-darkText rounded-full p-2 shadow-light dark:shadow-dark transition-all duration-300 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
        >
          ↓
        </Button>
      )}
      <form onSubmit={handleSubmit} className="p-4 dark:border-darkBorder">
        <div className="flex space-x-2">
          <div className="relative flex-grow">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              disabled={isLoading}
              className="relative flex min-h-[70px] w-full rounded-full text-text dark:text-darkText font-base selection:bg-main selection:text-text dark:selection:text-darkText dark:border-darkBorder bg-bg dark:bg-darkBg px-3 pl-14 py-2 text-sm ring-offset-bg dark:ring-offset-darkBg placeholder:text-text/50 dark:placeholder:text-darkText/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text dark:focus-visible:ring-darkText focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-2 border-border shadow-light"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text dark:text-darkText hover:text-main transition-colors duration-300 ease-in-out"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="submit"
              variant={"noShadow"}
              disabled={isLoading}
              className="absolute rounded-full right-5 bottom-4 bg-blue hover:bg-main text-text dark:text-darkText transition-all duration-300 ease-in-out hover:translate-x-boxShadowX hover:translate-y-boxShadowY"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

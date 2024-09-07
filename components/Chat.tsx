import React, { useRef, useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Message } from '@/lib/types'
import { Paperclip, Send, Loader2, Code } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { CodeProps } from 'react-markdown/lib/ast-to-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'

export function Chat({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  streamingMessage,
  streamingCodeExplanation,
  handleFileUpload
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
        code({node, inline, className, children, ...props}: CodeProps) {
          const match = /language-(\w+)/.exec(className || '')
          const lang = match && match[1] ? match[1] : ''
          const codeString = String(children).replace(/\n$/, '')
          
          if (inline) {
            return (
              <code className="px-1 py-0.5 rounded-md bg-muted text-muted-foreground text-sm font-mono" {...props}>
                {codeString}
              </code>
            )
          }
          
          return (
            <div className="rounded-xl overflow-hidden bg-muted my-4 shadow-lg w-full">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-400">
                <div className="flex items-center">
                  <Code className="w-5 h-5 mr-2 text-accent-foreground" />
                  <span className="text-sm font-medium text-accent-foreground">{lang.toUpperCase() || 'Code'}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <SyntaxHighlighter
                  style={tomorrow}
                  language={lang || 'javascript'}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            </div>
          )
        },
        p: ({children}) => <p className="mb-2">{children}</p>,
        h1: ({children}) => <h1 className="text-2xl font-bold mb-3">{children}</h1>,
        h2: ({children}) => <h2 className="text-xl font-bold mb-2">{children}</h2>,
        h3: ({children}) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
        ul: ({children}) => <ul className="list-disc list-inside mb-2">{children}</ul>,
        ol: ({children}) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
        li: ({children}) => <li className="mb-1">{children}</li>,
        blockquote: ({children}) => <blockquote className="border-l-4 border-accent pl-4 italic mb-2">{children}</blockquote>,
      }}
      className="prose prose-invert max-w-none"
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-background text-foreground">
      <ScrollArea className="flex-grow p-4 space-y-4" onScroll={handleScroll}>
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`flex ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start max-w-[80%]`}>
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>{message.role === 'user' ? 'U' : 'A'}</AvatarFallback>
              </Avatar>
              <div className={`mx-2 p-4 rounded-3xl ${
                message.role === 'assistant' 
                  ? 'bg-gradient-to-r from-green-600 via-lime-600 to-yellow-600'
                  : 'bg-gradient-to-r from-gray-800 via-slate-800 to-purple-900'
              } text-white break-words overflow-hidden shadow-md transition-all duration-300 ease-in-out hover:shadow-lg`}>
                {renderMessage(message.content)}
              </div>
            </div>
          </div>
        ))}
        {streamingMessage && (
          <div className="flex justify-start mb-4">
            <div className="flex flex-row items-start max-w-[80%]">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <div className="mx-2 p-4 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x text-white break-words overflow-hidden shadow-md transition-all duration-500 ease-in-out hover:shadow-lg">
                {renderMessage(streamingMessage)}
              </div>
            </div>
          </div>
        )}
        {streamingCodeExplanation && (
          <div className="flex justify-start mb-4">
            <div className="flex flex-row items-start max-w-[80%]">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <div className="mx-2 p-4 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x text-white break-words overflow-hidden shadow-md transition-all duration-500 ease-in-out hover:shadow-lg">
                {renderMessage(streamingCodeExplanation)}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>
      {!isAtBottom && (
        <Button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-20 right-8 bg-accent hover:bg-accent-foreground text-accent-foreground hover:text-accent rounded-full p-2 shadow-lg transition-all duration-300 ease-in-out"
        >
          ↓
        </Button>
      )}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex space-x-2">
          <div className="relative flex-grow">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              disabled={isLoading}
              className="pr-10 bg-input text-foreground placeholder-muted-foreground border-input focus:ring-2 focus:ring-accent transition-all duration-300 ease-in-out"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-accent transition-colors duration-300 ease-in-out"
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
          </div>
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="bg-accent hover:bg-accent-foreground text-accent-foreground hover:text-accent transition-all duration-300 ease-in-out"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
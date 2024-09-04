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
import './streaming-gradient.css'

const BACKGROUND_COLOR = 'bg-gray-900'
const TEXT_COLOR = 'text-gray-100'
const INPUT_BG_COLOR = 'bg-gray-800'
const BUTTON_BG_COLOR = 'bg-blue-600'
const BUTTON_HOVER_COLOR = 'hover:bg-blue-700'
const CODE_BG_COLOR = 'bg-[#1e2a4a]'
const CODE_HEADER_BG_COLOR = 'bg-[#2c3e50]'

export function Chat({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  streamingMessage,
  handleFileUpload
}: {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  streamingMessage: string;
  handleFileUpload: (content: string, fileName: string) => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingMessage, isAtBottom]);

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
            // Render inline code
            return (
              <code className="px-1 py-0.5 rounded-md bg-gray-800 text-sm font-mono" {...props}>
                {codeString}
              </code>
            )
          }
          
          // Render block code
          return (
            <div className={`rounded-xl overflow-hidden ${CODE_BG_COLOR} my-4 shadow-lg max-w-full`}>
              <div className={`flex items-center justify-between px-4 py-2 ${CODE_HEADER_BG_COLOR}`}>
                <div className="flex items-center">
                  <Code className="w-5 h-5 mr-2 text-blue-400" />
                  <span className="text-sm font-medium text-gray-200">{lang.toUpperCase() || 'Code'}</span>
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
                    background: 'transparent',
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            </div>
          )
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className={`flex flex-col h-full border border-gray-700 rounded-lg ${BACKGROUND_COLOR} ${TEXT_COLOR}`}>
      <ScrollArea className="flex-grow p-4 space-y-4" onScroll={handleScroll}>
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`flex ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start max-w-full w-full`}>
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>{message.role === 'user' ? 'U' : 'A'}</AvatarFallback>
              </Avatar>
              <div className={`mx-2 p-4 rounded-3xl ${
                message.role === 'assistant' 
                  ? 'bg-blue-700'
                  : 'bg-gray-700'
              } break-words overflow-hidden max-w-[calc(100%-3rem)] overflow-wrap-break-word`}>
                {renderMessage(message.content)}
              </div>
            </div>
          </div>
        ))}
        {streamingMessage && (
          <div className="flex justify-start mb-4">
            <div className="flex flex-row items-start max-w-full w-full">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <div className="mx-2 p-4 rounded-3xl streaming-gradient break-words overflow-hidden max-w-[calc(100%-3rem)] overflow-wrap-break-word">
                {renderMessage(streamingMessage)}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>
      {!isAtBottom && (
        <Button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          className={`absolute bottom-20 right-8 ${BUTTON_BG_COLOR} ${BUTTON_HOVER_COLOR} rounded-full p-2`}
        >
          ↓
        </Button>
      )}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <div className="relative flex-grow">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              disabled={isLoading}
              className={`pr-10 ${INPUT_BG_COLOR} ${TEXT_COLOR} placeholder-gray-400 border-gray-600`}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
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
          <Button type="submit" disabled={isLoading} className={`${BUTTON_BG_COLOR} ${BUTTON_HOVER_COLOR}`}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
'use client'

import { useEffect } from "react";
import { Message } from 'ai'
import { useChat } from 'ai/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Components
import Chatbar from '@/components/core/chatbar'
import { Message as AIMessage } from '@/components/core/message'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PreviewPanel } from './PreviewPanel'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'

// Types & Utils
import modelsList from '@/lib/models.json'
import { App, ExecutionResult } from '@/lib/schema'
import { CustomMessage, LLMModelConfig } from '@/lib/types'
import { useToolState } from '@/lib/stores/tool-state-store'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { createVersion } from '@/lib/supabase'
import { useSandboxStore } from "@/lib/stores/sandbox-store"

// Types
interface ChatProps {
    chatId?: string | null
    initialMessages?: Message[]
    onChatCreated?: (chatId: string) => void
    onFileSelect?: (file: { content: string; name: string }) => void
    onUpdateStreamlit?: (message: string) => void
    onChatSubmit?: () => void
    onChatFinish?: () => void
    onCodeClick?: () => void
    setActiveTab?: (tab: string) => void
    isChatCentered?: boolean
    isRightContentVisible?: boolean
    setIsRightContentVisible: (visible: boolean | ((prev: boolean) => boolean)) => void
}

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

type ChatMessage = Message & {
    createdAt?: Date
    toolInvocations?: any[]
}

// Custom Handle Component
const CustomHandle = ({ ...props }) => (
    <ResizableHandle {...props} withHandle className="relative">
        <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
            <div className="h-8 w-1 rounded-full bg-black" />
        </div>
    </ResizableHandle>
)

// Utility Functions
const getOrCreateApp = async (chatId: string | null, userId: string) => {
    if (!chatId) throw new Error('No chat ID provided')
    const supabase = createClientComponentClient()

    const { data: chat } = await supabase
        .from('chats')
        .select('app_id')
        .eq('id', chatId)
        .single()

    if (chat?.app_id) return chat.app_id

    const { data: app, error: appError } = await supabase
        .from('apps')
        .insert({
            user_id: userId,
            name: 'New App',
            description: 'App created from chat',
            is_public: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: userId,
        })
        .select()
        .single()

    if (appError) throw appError

    await supabase.from('chats').update({ app_id: app.id }).eq('id', chatId)

    return app.id
}

export function Playground({
    chatId = null,
    initialMessages = [],
    onChatCreated,
    onFileSelect,
    onUpdateStreamlit,
    onChatSubmit,
    onChatFinish,
    onCodeClick,
    setActiveTab,
    isChatCentered = false,
    isRightContentVisible = false,
    setIsRightContentVisible,
}: ChatProps) {
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const resizableGroupRef = useRef<any>(null)
    const versionSelectorRef = useRef<{ refreshVersions: () => void } | null>(null)
    const newChatIdRef = useRef<string | null>(null)

    // State Management
    const [errorState, setErrorState] = useState<Error | null>(null)
    const [attachedFile, setAttachedFile] = useState<File | null>(null)
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        isUploading: false,
        progress: 0,
        error: null,
    })
    const [generatedCode, setGeneratedCode] = useState<string>('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [showCodeView, setShowCodeView] = useState(false)
    const [currentApp, setCurrentApp] = useState<{ id: string } | null>(null)
    const [isCreatingVersion, setIsCreatingVersion] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [currentPreview, setCurrentPreview] = useState<{
        object: App | undefined
        result: ExecutionResult | undefined
    }>({
        object: undefined,
        result: undefined,
    })

    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [sandboxErrors, setSandboxErrors] = useState<Array<{ message: string }>>([])
    const isVersionSwitching = useRef(false)

    const handleRefresh = async () => {
        if (sandboxId && session?.user?.id) {
            try {
                setIsGeneratingCode(true)
                await updateStreamlitApp(generatedCode, true)
            } catch (error) {
                console.error('Error refreshing app:', error)
            } finally {
                setIsGeneratingCode(false)
            }
        }
    }

    // Hooks
    const { session } = useAuth()
    const supabase = createClientComponentClient()
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20241022',
    })
    const { initializeSandbox, killSandbox, updateSandbox } = useSandboxStore()
    const { startToolCall, updateToolCallDelta, completeToolCall } = useToolState()

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Chat Configuration
    const {
        messages: aiMessages,
        input,
        handleInputChange,
        handleSubmit: originalHandleSubmit,
        isLoading,
        setMessages: setAiMessages,
        append,
    } = useChat({
        api: chatId ? `/api/conversations/${chatId}/stream` : '/api/conversations/stream',
        id: chatId ?? undefined,
        initialMessages,
        body: {
            model: currentModel,
            config: languageModel,
            experimental_streamData: true,
        },
        maxSteps: 10,
        sendExtraMessageFields: true,
        onResponse: async (response) => {
            if (!response.ok) {
                handleResponseError(response)
                return
            }

            if (!chatId) {
                const newChatId = response.headers.get('x-chat-id')
                if (newChatId) {
                    newChatIdRef.current = newChatId
                }
            }

            const toolCallId = response.headers.get('x-tool-call-id')
            const toolName = response.headers.get('x-tool-name')
            const toolProgress = response.headers.get('x-tool-progress')
            const toolTotalChunks = response.headers.get('x-tool-total-chunks')
            const toolDelta = response.headers.get('x-tool-delta')

            if (toolCallId && toolName) {
                if (toolDelta) {
                    updateToolCallDelta(
                        toolCallId,
                        toolDelta,
                        toolProgress ? parseInt(toolProgress) : undefined,
                        toolTotalChunks ? parseInt(toolTotalChunks) : undefined
                    )
                } else {
                    startToolCall(toolCallId, toolName)
                }
            }
        },
        onFinish: async (message) => {
            console.log('Message steps:', message)
            setErrorState(null)
            setAttachedFile(null)
            resetFileUploadState()

            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }

            if (
                message.role === 'assistant' &&
                !chatId &&
                newChatIdRef.current
            ) {
                onChatCreated?.(newChatIdRef.current)
                newChatIdRef.current = null
            }

            if (message.toolInvocations?.length) {
                const toolCall = message.toolInvocations[0]
                if (toolCall.toolCallId) {
                    completeToolCall(toolCall.toolCallId)
                }
            }

            onChatFinish?.()

            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .filter(
                        (invocation) =>
                            invocation.toolName === 'create_streamlit_app' &&
                            invocation.state === 'result'
                    )
                    .pop()

                if (streamlitCall?.state === 'result') {
                    const code = streamlitCall.result
                    if (code) {
                        setIsCreatingVersion(true)
                        setGeneratedCode(code)
                        onUpdateStreamlit?.(code)

                        if (session?.user?.id) {
                            try {
                                let appId = await getOrCreateApp(
                                    chatId,
                                    session.user.id
                                )
                                const versionData = await createVersion(
                                    appId,
                                    code
                                )
                                setCurrentApp({ id: appId })

                                if (versionSelectorRef.current) {
                                    await versionSelectorRef.current.refreshVersions()
                                }
                            } catch (error) {
                                setIsCreatingVersion(false)
                            }
                        }
                    }
                }
            }

            if (message.content.trim()) {
                setMessages((prev: ChatMessage[]) => {
                    const assistantMessage: ChatMessage = {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: message.content,
                        createdAt: new Date(),
                        toolInvocations: message.toolInvocations,
                    }
                    return [...prev, assistantMessage]
                })
            }
        },
        onError: (error) => {
            handleChatError(error)
            setIsGeneratingCode(false)
        },
    })

    const scrollAreaRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollArea = scrollAreaRef.current
            scrollArea.scrollTop = scrollArea.scrollHeight
        }
    }, [messages])

    useEffect(() => {
        if (isLoading) {
            setIsGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [isLoading])

    useEffect(() => {
        initializeSandbox()

        return () => {
            killSandbox()
        }
    }, [initializeSandbox, killSandbox])

    const initializationComplete = useRef(false)
    const initializationPromise = useRef<Promise<void> | null>(null)

    const ensureSandboxInitialized = useCallback(async () => {
        if (initializationComplete.current) {
            return
        }

        if (!initializationPromise.current) {
            initializationPromise.current = (async () => {
                await initializeSandbox()
                initializationComplete.current = true
            })()
        }

        return initializationPromise.current
    }, [initializeSandbox])

    const updateStreamlitApp = useCallback(
        async (code: string, forceExecute = false) => {
            await ensureSandboxInitialized()

            const url = await updateSandbox(code, forceExecute)
            if (url) {
                setStreamlitUrl(url)
                setIsGeneratingCode(false)
            }
        },
        [updateSandbox, ensureSandboxInitialized]
    )

    useEffect(() => {
        const initializeChatAndSandbox = async () => {
            await ensureSandboxInitialized()
            if (generatedCode) {
                await updateStreamlitApp(generatedCode, true)
            }
        }

        initializeChatAndSandbox()

        return () => {
            killSandbox()
            initializationComplete.current = false
            initializationPromise.current = null
        }
    }, [ensureSandboxInitialized, generatedCode, updateStreamlitApp, killSandbox])

    useEffect(() => {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.toolInvocations?.length) {
            const streamlitCall = lastMessage.toolInvocations.find(
                (invocation) =>
                    invocation.toolName === 'create_streamlit_app' &&
                    invocation.state === 'result'
            )

            if (streamlitCall?.state === 'result') {
                setGeneratedCode(streamlitCall.result)
                setIsGeneratingCode(false)
                updateStreamlitApp(streamlitCall.result)
            }
        }
    }, [messages, updateStreamlitApp])

    useEffect(() => {
        if (generatedCode) {
            setIsRightContentVisible(true)
        }
    }, [generatedCode, setIsRightContentVisible])

    // Add debug log for page load
    useEffect(() => {
        if (generatedCode && sandboxId) {
            updateStreamlitApp(generatedCode, true)
        }
    }, [generatedCode, sandboxId, updateStreamlitApp])

    const resetFileUploadState = () => {
        setFileUploadState({
            isUploading: false,
            progress: 0,
            error: null,
        })
    }

    // Add this function before the useEffect hooks
    const fetchToolResults = useCallback(async () => {
        if (!chatId) return

        try {
            const response = await fetch(
                `/api/conversations/${chatId}/messages`
            )
            if (!response.ok) throw new Error('Failed to fetch messages')

            const data = await response.json()

            // Find the last Streamlit code generation result
            const streamlitCode = data.messages
                .filter((msg: any) => msg.tool_results && Array.isArray(msg.tool_results))
                .map((msg: any) => {
                    const toolResult = msg.tool_results[0]
                    if (toolResult && toolResult.name === 'create_streamlit_app') {
                        return toolResult.result
                    }
                    return null
                })
                .filter(Boolean)
                .pop()

            if (streamlitCode) {
                setGeneratedCode(streamlitCode)
                if (!isGeneratingCode) {
                    await updateStreamlitApp(streamlitCode)
                }
                await updateStreamlitApp(streamlitCode, true)
            }
        } catch (error) {
            console.error('Error fetching tool results:', error)
        }
    }, [chatId, updateStreamlitApp, isGeneratingCode])

    // The existing useEffect will now work with the defined function
    useEffect(() => {
        const initializeChatAndSandbox = async () => {
            if (chatId) {
                await ensureSandboxInitialized()
                await fetchToolResults()
            }
        }

        initializeChatAndSandbox()
    }, [chatId, fetchToolResults, ensureSandboxInitialized])

    useEffect(() => {
        if (generatedCode) {
            setIsRightContentVisible(true)
        }
    }, [generatedCode, setIsRightContentVisible])

    // Modify cleanup
    useEffect(() => {
        return () => {
            killSandbox()
            initializationComplete.current = false
            initializationPromise.current = null
        }
    }, [killSandbox])

    // Modify fetchAppId
    const fetchAppId = useCallback(async () => {
        if (!chatId) return

        const { data: chat } = await supabase
            .from('chats')
            .select('app_id')
            .eq('id', chatId)
            .single()

        if (chat?.app_id) {
            setCurrentApp({ id: chat.app_id })

            const { data: versions } = await supabase
                .from('versions')
                .select('*')
                .eq('app_id', chat.app_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (versions?.code) {
                setGeneratedCode(versions.code)
                await updateStreamlitApp(versions.code, true)
            }
        }
    }, [chatId, supabase, updateStreamlitApp])

    useEffect(() => {
        fetchAppId()
    }, [fetchAppId])

    const uploadFile = async (file: File): Promise<any> => {
        const formData = new FormData()
        formData.append('file', file)
        if (chatId) {
            formData.append('chatId', chatId)
        }

        const response = await fetch('/api/files', {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            throw new Error('Failed to upload file')
        }

        return await response.json()
    }

    const [isCreatingChat, setIsCreatingChat] = useState(false)

    const handleRetry = useCallback(async () => {
        setErrorState(null)
        if (
            messages.length > 0 &&
            messages[messages.length - 1].role === 'user'
        ) {
            try {
                await originalHandleSubmit(undefined as any)
            } catch (e) {
                console.error('Retry failed:', e)
            }
        }
    }, [messages, originalHandleSubmit])

    const handleTextareaChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            handleInputChange(e)
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
            }
        },
        [handleInputChange]
    )

    const handleCodeViewToggle = () => {
        setShowCodeView(!showCodeView)
    }

    const handleChatSubmit = async (content: string, file?: File) => {
        try {
            onChatSubmit?.()
            if (!chatId) {
                setIsCreatingChat(true)
            }

            // Handle file upload case
            if (file) {
                const fileData = await uploadFile(file)
                const fileContent = await file.text()

                // Sanitize content
                const sanitizedContent = fileContent
                    .split('\n')
                    .map((row) => row.replace(/[\r\n]+/g, ''))
                    .join('\n')

                const rows = sanitizedContent.split('\n')
                const columnNames = rows[0]
                const previewRows = rows.slice(1, 6).join('\n')
                const dataPreview = `⚠️ EXACT column names:\n${columnNames}\n\nFirst 5 rows:\n${previewRows}`

                // const message = content.trim() ||
                //     `Create a Streamlit app to visualize this data from "/app/${file.name}". The file is at '/app/${file.name}'.\n${dataPreview}\nCreate a complex, aesthetic visualization using these exact column names.`;

                const message =
                    content.trim() ||
                    `Create a Streamlit app to visualize this data. The file is stored in the directory '/app/' and is named "${file.name}". Ensure all references to the file use the full path '/app/${file.name}'.\n${dataPreview}\nCreate a complex, aesthetic visualization using these exact column names.`

                await append(
                    {
                        content: message,
                        role: 'user',
                        createdAt: new Date(),
                    },
                    {
                        body: {
                            fileId: fileData.id,
                            fileName: file.name,
                            fileContent: sanitizedContent,
                        },
                    }
                )

                // Reset file state
                setAttachedFile(null)
                resetFileUploadState()
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
            }
            // Handle regular text message case
            else if (content.trim()) {
                await append({
                    content: content.trim(),
                    role: 'user',
                    createdAt: new Date(),
                })
            }
        } catch (error) {
            console.error('Error submitting message:', error)
            setFileUploadState((prev) => ({
                ...prev,
                error: 'Failed to send message. Please try again.',
            }))
        } finally {
            setFileUploadState((prev) => ({ ...prev, isUploading: false }))
        }
    }

    const memoizedMessages = useMemo(() => {
        const messageMap = new Map<string, ChatMessage>()

            ;[...initialMessages, ...aiMessages].forEach((msg: ChatMessage) => {
                const key = `${msg.role}:${msg.content}`
                if (
                    !messageMap.has(key) ||
                    (msg.createdAt &&
                        (!messageMap.get(key)?.createdAt ||
                            new Date(msg.createdAt) >
                            new Date(messageMap.get(key)!.createdAt!)))
                ) {
                    messageMap.set(key, msg)
                }
            })

        return Array.from(messageMap.values()).sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return timeA - timeB
        })
    }, [initialMessages, aiMessages])

    useEffect(() => {
        if (generatedCode) {
            updateStreamlitApp(generatedCode, true)
        }
    }, [generatedCode, updateStreamlitApp])

    const handleResponseError = (response: Response) => {
        const errorMessage =
            response.status === 429
                ? 'Rate limit exceeded. Please wait a moment.'
                : response.status === 413
                    ? 'Message too long. Please try a shorter message.'
                    : 'An error occurred. Please try again.'

        setErrorState(new Error(errorMessage))
    }

    const handleChatError = (error: Error) => {
        if (!errorState) {
            const errorMessage = error.message.includes('Failed to fetch')
                ? 'Network error. Please check your connection.'
                : error.message
            setErrorState(new Error(errorMessage))
        }
    }

    // Add loading effect
    useEffect(() => {
        if (isLoading) {
            setIsGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [isLoading])

    // Add sandbox error handling
    const handleSandboxError = useCallback((error: Error) => {
        setSandboxErrors((prev) => [...prev, { message: error.message }])
    }, [])

    // Render Methods
    const renderMessages = () => (
        <ScrollArea className="flex-grow p-4 space-y-4 w-full h-full max-w-[800px] m-auto">
            {memoizedMessages.map((message, index) => (
                <div key={message.id}>
                    <AIMessage
                        {...message}
                        isLastMessage={index === memoizedMessages.length - 1}
                        isCreatingChat={false}
                        object={(message as CustomMessage).object}
                        result={(message as CustomMessage).result}
                        isLoading={isLoading}
                        onObjectClick={({ object, result }) => {
                            setCurrentPreview?.({ object, result })
                            if (object?.code) {
                                onUpdateStreamlit?.(object.code)
                            }
                        }}
                        onToolResultClick={(result) => {
                            onUpdateStreamlit?.(result)
                        }}
                        onCodeClick={(messageId: string) => {
                            setMessages((prevMessages: Message[]) =>
                                prevMessages.map((msg: Message) =>
                                    msg.id === messageId
                                        ? {
                                            ...msg,
                                            isCodeVisible: !(msg as CustomMessage).isCodeVisible,
                                        }
                                        : msg
                                )
                            )
                            setActiveTab?.('code')
                            setIsRightContentVisible?.((prev: boolean) => !prev)
                        }}
                    />
                </div>
            ))}
            <div ref={messagesEndRef} />
        </ScrollArea>
    )

    const isInputDisabled = !!attachedFile
    const placeholderText = attachedFile
        ? 'File attached. Remove file to type a message.'
        : 'Type your message...'

    // Return JSX
    return (
        <div className="w-full h-full">
            <ResizablePanelGroup direction="horizontal" ref={resizableGroupRef}>
                <ResizablePanel defaultSize={40} minSize={30}>
                    {/* Main Chat Panel */}
                    <div className={cn(
                        "flex flex-col relative bg-background text-foreground border border-border rounded-2xl",
                        isChatCentered ? "h-full" : "h-full"
                    )}>
                        {/* Messages Section */}
                        <motion.div
                            className={cn(
                                "flex-grow",
                                isChatCentered ? "opacity-0" : "opacity-100"
                            )}
                            initial={false}
                            animate={{
                                opacity: isChatCentered ? 0 : 1,
                                height: isChatCentered ? 0 : "auto"
                            }}
                            transition={{ duration: 0.5 }}
                        >
                            {renderMessages()}
                        </motion.div>

                        {/* Error States */}
                        {errorState && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="p-4 text-center"
                            >
                                <p className="text-red-500 mb-2">{errorState.message}</p>
                                <Button onClick={() => setErrorState(null)} variant="secondary" size="sm">
                                    Dismiss
                                </Button>
                            </motion.div>
                        )}

                        {/* Chat Input */}
                        <motion.div
                            className="w-full"
                            initial={false}
                            animate={{
                                position: "relative",
                                y: isChatCentered ? "-50vh" : 0,
                                marginTop: isChatCentered ? "auto" : 0
                            }}
                            transition={{
                                duration: 0.5,
                                ease: [0.32, 0.72, 0, 1]
                            }}
                        >
                            <Chatbar
                                onSubmit={handleChatSubmit}
                                isLoading={isLoading}
                                className={cn(
                                    "transition-all duration-500",
                                    isChatCentered && "p-6 border-t shadow-lg"
                                )}
                            />
                        </motion.div>
                    </div>
                </ResizablePanel>

                {/* Preview Panel */}
                {isRightContentVisible && (
                    <>
                        <CustomHandle className="bg-gradient-to-r from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 transition-colors" />
                        <ResizablePanel
                            defaultSize={60}
                            minSize={40}
                            className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden rounded-xl bg-white h-[calc(100vh-4rem)] border border-gray-200"
                        >
                            <PreviewPanel
                                streamlitUrl={streamlitUrl}
                                generatedCode={generatedCode}
                                isGeneratingCode={isGeneratingCode}
                                showCodeView={showCodeView}
                                onRefresh={handleRefresh}
                                onCodeViewToggle={handleCodeViewToggle}
                            />
                        </ResizablePanel>
                    </>
                )}
            </ResizablePanelGroup>
        </div>
    )
}

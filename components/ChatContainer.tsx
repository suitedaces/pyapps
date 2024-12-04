'use client'

import { Chat } from '@/components/Chat'
import { PreviewPanel, PreviewPanelRef } from '@/components/PreviewPanel'
import { Button } from '@/components/ui/button'
import { ResizablePanel, ResizablePanelGroup, CustomHandle } from '@/components/ui/resizable'
import { useChat } from 'ai/react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { VersionSelector } from '@/components/VersionSelector'
import { createVersion } from '@/lib/supabase'
import { StreamlitPreviewRef } from '@/components/StreamlitPreview'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import modelsList from '@/lib/models.json'
import { useLocalStorage } from 'usehooks-ts'
import { AppVersion, LLMModelConfig, Message } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'

export interface ChatContainerProps {
    isRoot: boolean
}

export default function ChatContainer({ isRoot }: ChatContainerProps) {
    const { session } = useAuth()
    const router = useRouter()
    const params = useParams()
    const supabase = createClientComponentClient()
    const chatId = !isRoot ? (params?.id as string) : null

    // Core state
    const [currentChatId, setCurrentChatId] = useState<string | null>(chatId)
    const [initialMessages, setInitialMessages] = useState([])
    const [activeTab, setActiveTab] = useState('preview')
    const [isRightContentVisible, setIsRightContentVisible] = useState(false)
    const [generatedCode, setGeneratedCode] = useState('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
    const [isCreatingVersion, setIsCreatingVersion] = useState(false)
    const [currentApp, setCurrentApp] = useState<{ id: string } | null>(null)
    const [isChatCentered, setIsChatCentered] = useState(isRoot)
    const [showCodeView, setShowCodeView] = useState(false)

    const resizableGroupRef = useRef<any>(null)
    const streamlitPreviewRef = useRef<PreviewPanelRef>(null)
    const isVersionSwitching = useRef(false)
    const versionSelectorRef = useRef<{
        refreshVersions: () => void
    } | null>(null)

    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20241022',
    })

    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    const fetchMessages = useCallback(async (fetchChatId: string) => {
        try {
            const response = await fetch(`/api/conversations/${fetchChatId}/messages`)
            if (!response.ok) throw new Error('Failed to fetch messages')
            const data = await response.json()

            const messages = data.messages.flatMap((msg: any) => {
                const messages: Message[] = []
                if (msg.user_message) {
                    messages.push({
                        id: `${msg.id}-user`,
                        role: 'user',
                        content: msg.user_message,
                    })
                }
                if (msg.assistant_message) {
                    messages.push({
                        id: `${msg.id}-assistant`,
                        role: 'assistant',
                        content: msg.assistant_message,
                        toolInvocations: msg.tool_calls?.map((call: any) => ({
                            toolCallId: call.id,
                            toolName: call.name,
                            state: 'result',
                            result: call.result
                        })) || [],
                    })
                }
                return messages
            })

            setInitialMessages(messages)
        } catch (error) {
            console.error('Error fetching messages:', error)
        }
    }, [])

    const handleChatSelect = useCallback(async (selectedChatId: string) => {
        try {
            // Reset states first
            setGeneratedCode('')
            setStreamlitUrl(null)
            setIsGeneratingCode(false)
            setShowCodeView(false)
            
            // Then update chat ID and fetch messages
            setCurrentChatId(selectedChatId)
            await fetchMessages(selectedChatId)
            
        } catch (error) {
            console.error('Error selecting chat:', error)
        }
    }, [fetchMessages])

    useEffect(() => {
        if (chatId && !isRoot) {
            handleChatSelect(chatId)
        }
    }, [chatId, isRoot, handleChatSelect])

    const handleChatCreated = useCallback((newChatId: string) => {
        if (isRoot) {
            setCurrentChatId(newChatId)
            router.push(`/chat/${newChatId}`)
        }
    }, [isRoot, router])

    const handleChatSubmit = useCallback(() => {
        setIsChatCentered(false)
    }, [])

    const { killSandbox, updateSandbox } = useSandboxStore()

    useEffect(() => {
        const cleanup = () => {
            killSandbox().catch(console.error)
        }
        return cleanup
    }, [killSandbox])

    const updateStreamlitApp = useCallback(async (code: string, forceExecute: boolean = false) => {
        try {
            setIsGeneratingCode(true)
            setGeneratedCode(code)
            
            const url = await updateSandbox(code, forceExecute)
            if (url) {
                setStreamlitUrl(url)
                // Wait for URL to be set before refreshing
                await new Promise(resolve => setTimeout(resolve, 500))
                streamlitPreviewRef.current?.refreshIframe()
            }
        } catch (error) {
            console.error('Failed to update sandbox:', error)
        } finally {
            setIsGeneratingCode(false)
        }
    }, [updateSandbox])

    const handleVersionChange = async (version: AppVersion) => {
        if (!version.code) return

        isVersionSwitching.current = true
        setIsGeneratingCode(true)

        try {
            setGeneratedCode(version.code)
            await updateStreamlitApp(version.code, true)
        } catch (error) {
            console.error('Failed to update app with version:', error)
        } finally {
            setTimeout(() => {
                setIsGeneratingCode(false)
                isVersionSwitching.current = false
            }, 500)
        }
    }

    const {
        messages,
        setMessages,
        isLoading: chatLoading,
    } = useChat({
        api: currentChatId 
            ? `/api/conversations/${currentChatId}/stream`
            : '/api/conversations/stream',
        id: currentChatId ?? undefined,
        initialMessages,
        body: {
            model: currentModel,
            config: languageModel,
            experimental_streamData: true,
        },
        onResponse: (response) => {
            if (!response.ok) return

            if (!currentChatId) {
                const newChatId = response.headers.get('x-chat-id')
                if (newChatId) {
                    handleChatCreated(newChatId)
                }
            }
        },
        onFinish: async (message) => {
            if (message.toolInvocations?.length) {
                const streamlitCall = message.toolInvocations
                    .filter(
                        (invocation: any) =>
                            invocation.toolName === 'create_streamlit_app' &&
                            invocation.state === 'result'
                    )
                    .pop()

                if (streamlitCall?.state === 'result') {
                    const code = streamlitCall.result
                    if (code && session?.user?.id) {
                        try {
                            setIsCreatingVersion(true)
                            setGeneratedCode(code)
                            await updateStreamlitApp(code)

                            const { data: chat } = await supabase
                                .from('chats')
                                .select('app_id')
                                .eq('id', currentChatId)
                                .single()

                            let appId = chat?.app_id

                            if (!appId) {
                                const { data: app, error: appError } = await supabase
                                    .from('apps')
                                    .insert({
                                        user_id: session.user.id,
                                        name: messages[0].content.slice(0, 50) + '...',
                                        description: 'Streamlit app created from chat',
                                        is_public: false,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                        created_by: session.user.id,
                                    })
                                    .select()
                                    .single()

                                if (appError) throw appError
                                appId = app.id

                                await supabase
                                    .from('chats')
                                    .update({ app_id: appId })
                                    .eq('id', currentChatId)
                            }

                            await createVersion(appId, code)
                            setCurrentApp({ id: appId })

                            if (versionSelectorRef.current) {
                                await versionSelectorRef.current.refreshVersions()
                            }
                        } catch (error) {
                            console.error('Failed to handle version creation:', error)
                        } finally {
                            setIsCreatingVersion(false)
                        }
                    }
                }
            }

            if (versionSelectorRef.current) {
                versionSelectorRef.current.refreshVersions()
            }
        },
    })

    useEffect(() => {
        if (chatLoading) {
            setIsGeneratingCode(true)
            setGeneratedCode('')
        }
    }, [chatLoading])

    const toggleRightContent = useCallback(() => {
        setIsRightContentVisible(prev => !prev)
        if (resizableGroupRef.current) {
            setTimeout(() => resizableGroupRef.current.resetLayout(), 0)
        }
    }, [])

    const handleRefresh = useCallback(() => {
        if (streamlitPreviewRef.current) {
            streamlitPreviewRef.current.refreshIframe()
        }
        setIsGeneratingCode(true)
        setTimeout(() => setIsGeneratingCode(false), 500)
    }, [])

    const handleCodeViewToggle = useCallback(() => {
        setShowCodeView(prev => !prev)
    }, [])

    return (
        <ResizablePanelGroup
            direction="horizontal"
            ref={resizableGroupRef}
            className="bg-white"
        >
            <ResizablePanel
                defaultSize={40}
                minSize={30}
                className="relative bg-white"
            >
                <Chat
                    chatId={currentChatId}
                    initialMessages={initialMessages}
                    onChatCreated={handleChatCreated}
                    onChatSubmit={handleChatSubmit}
                    onUpdateStreamlit={updateStreamlitApp}
                    setActiveTab={setActiveTab}
                    setIsRightContentVisible={setIsRightContentVisible}
                    isChatCentered={isChatCentered}
                    onCodeClick={() => {
                        setActiveTab('code')
                        setIsRightContentVisible(true)
                        resizableGroupRef.current?.resetLayout()
                    }}
                />
            </ResizablePanel>

            {isRightContentVisible && (
                <>
                    <CustomHandle />
                    <ResizablePanel defaultSize={60} minSize={45}>
                        <PreviewPanel
                            ref={streamlitPreviewRef}
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

            <div className="absolute top-2 right-4 z-30 flex justify-between items-center gap-4">
                {currentApp?.id && (
                    <VersionSelector
                        appId={currentApp.id}
                        onVersionChange={handleVersionChange}
                        ref={versionSelectorRef}
                    />
                )}
                <Button
                    onClick={toggleRightContent}
                    className={cn(
                        'bg-black hover:bg-black/90',
                        'text-white',
                        'border border-transparent',
                        'transition-all duration-200 ease-in-out',
                        'shadow-lg hover:shadow-xl',
                        'rounded-lg'
                    )}
                >
                    {isRightContentVisible ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </ResizablePanelGroup>
    )
}
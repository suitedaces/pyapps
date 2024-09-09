import { useState, useCallback, useEffect } from 'react'
import { useUser } from '@auth0/nextjs-auth0/client'
import { Message, StreamChunk } from '@/lib/types'

export function useChat() {
  const { user } = useUser()
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [csvContent, setCsvContent] = useState<string | null>(null)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null)
  const [generatedCode, setGeneratedCode] = useState('')
  const [streamingMessage, setStreamingMessage] = useState('')
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [codeExplanation, setCodeExplanation] = useState('')

  useEffect(() => {
    if (user) {
      initializeChat()
    }
  }, [user])

  const initializeChat = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        setChatId(data.chatId)
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error initializing chat:', error)
    }
  }, [])

  const processStreamChunk = useCallback((chunk: StreamChunk, accumulatedResponse: string, accumulatedCode: string) => {
    if (chunk.type === 'content_block_delta' && 'delta' in chunk && chunk.delta?.type === 'text_delta') {
      accumulatedResponse += chunk.delta.text
      setStreamingMessage(prev => prev + chunk.delta.text)
    } else if (chunk.type === 'generated_code' && 'content' in chunk) {
      accumulatedCode += chunk.content
      setGeneratedCode(prev => prev + chunk.content)
    } else if (chunk.type === 'code_explanation' && 'content' in chunk) {
      setCodeExplanation(prev => prev + chunk.content)
    } else if (chunk.type === 'message_stop') {
      setIsGeneratingCode(false)
    } else if (chunk.type === 'tool_use' && chunk.name === 'create_streamlit_app') {
      setIsGeneratingCode(true)
    }
    return { accumulatedResponse, accumulatedCode }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || !chatId) return

    setIsLoading(true)
    const newMessage: Message = { role: 'user', content: input, createdAt: new Date(), chatId }
    setMessages(prev => [...prev, newMessage])
    setInput('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [newMessage], 
          csvContent, 
          csvFileName, 
          chatId 
        }),
      })

      if (!response.ok) throw new Error('Chat API request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Failed to get response reader')

      let accumulatedResponse = ''
      let accumulatedCode = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          const parsedChunk: StreamChunk = JSON.parse(line)
          const result = processStreamChunk(parsedChunk, accumulatedResponse, accumulatedCode)
          accumulatedResponse = result.accumulatedResponse
          accumulatedCode = result.accumulatedCode
        }
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: accumulatedResponse, createdAt: new Date(), chatId }
      ])

      if (accumulatedCode) {
        setGeneratedCode(accumulatedCode)
        await updateStreamlitApp(accumulatedCode)
      }

    } catch (error) {
      console.error('Error in chat operation:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'An error occurred. Please try again.', 
        createdAt: new Date(),
        chatId 
      }])
    } finally {
      setIsLoading(false)
      setStreamingMessage('')
      setIsGeneratingCode(false)
    }
  }, [input, chatId, csvContent, csvFileName, processStreamChunk])

  const updateStreamlitApp = useCallback(async (code: string) => {
    try {
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'updateCode', 
          code, 
          chatId 
        }),
      })

      if (!response.ok) throw new Error('Failed to update Streamlit app')

      const data = await response.json()
      setStreamlitUrl(data.url)
    } catch (error) {
      console.error('Error updating Streamlit app:', error)
    }
  }, [chatId])

  const handleFileUpload = useCallback(async (content: string, fileName: string) => {
    if (!chatId) return

    setCsvContent(content)
    setCsvFileName(fileName)

    try {
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'uploadFile', 
          fileName, 
          fileContent: content, 
          chatId 
        }),
      })

      if (!response.ok) throw new Error('File upload failed')

      const data = await response.json()
      console.log('File uploaded:', data.path)

      const newMessage: Message = {
        role: 'user',
        content: `Uploaded file: ${fileName}`,
        createdAt: new Date(),
        chatId
      }
      setMessages(prev => [...prev, newMessage])

      handleSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>)

    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }, [chatId, handleSubmit])

  return {
    messages,
    input,
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value),
    handleSubmit,
    isLoading,
    handleFileUpload,
    streamlitUrl,
    generatedCode,
    streamingMessage,
    isGeneratingCode,
    streamingCodeExplanation: codeExplanation,
    chatId,
  }
}
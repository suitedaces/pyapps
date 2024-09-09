import Anthropic from "@anthropic-ai/sdk"

export type ToolCall = {
  id: string
  name: string
  parameters: string
}

export type ToolResult = {
  id: string
  name: string
  result: any
  error?: any
}

export type Message = {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  createdAt: Date
  chatId: string
}

export type StreamChunk = {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'generated_code' | 'code_explanation' | 'error' | 'tool_use'
  message?: any
  contentBlock?: any
  delta?: any
  content?: string
  name?: string
}

export type CSVAnalysis = {
  totalRows: number
  columns: {
    name: string
    type: string
  }[]
  sampleRows: string[][]
}

export type CreateStreamlitAppTool = {
  query: string
  csvAnalysis: CSVAnalysis
}

export type Tool = Anthropic.Messages.Tool

export type Chat = {
  id: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export type StreamlitApp = {
  id: string
  name: string
  chatId: string
  createdAt: Date
  updatedAt: Date
  currentVersionId: string | null
}

export type StreamlitAppVersion = {
  id: string
  code: string
  versionNumber: number
  createdAt: Date
  appId: string
}

export type File = {
  id: string
  chatId: string
  name: string
  path: string
  content: string
  createdAt: Date
}
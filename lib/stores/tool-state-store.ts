import { create } from 'zustand'

interface ToolState {
  // Track loading states for each tool call
  loadingStates: Record<string, {
    isLoading: boolean
    toolName: string
    messageId?: string
  }>

  // Track current tool call progress
  currentToolCall: {
    toolCallId: string | null
    toolName: string | null
    state: 'streaming' | 'delta' | 'complete' | null
  }

  // Actions
  startToolCall: (toolCallId: string, toolName: string, messageId?: string) => void
  updateToolCallDelta: (toolCallId: string) => void
  completeToolCall: (toolCallId: string) => void
  resetToolCall: (toolCallId: string) => void

  // View state management
  isCodeViewOpen: boolean
  setCodeViewOpen: (isOpen: boolean) => void
}

export const useToolState = create<ToolState>((set) => ({
  loadingStates: {},
  currentToolCall: {
    toolCallId: null,
    toolName: null,
    state: null
  },

  // Handle tool call start (b: protocol)
  startToolCall: (toolCallId, toolName, messageId) => set((state) => ({
    loadingStates: {
      ...state.loadingStates,
      [toolCallId]: {
        isLoading: true,
        toolName,
        messageId
      }
    },
    currentToolCall: {
      toolCallId,
      toolName,
      state: 'streaming'
    }
  })),

  // Handle tool call delta (c: protocol)
  updateToolCallDelta: (toolCallId) => set((state) => ({
    currentToolCall: {
      ...state.currentToolCall,
      state: 'delta'
    }
  })),

  // Handle tool call completion (9: protocol)
  completeToolCall: (toolCallId) => set((state) => ({
    loadingStates: {
      ...state.loadingStates,
      [toolCallId]: {
        ...state.loadingStates[toolCallId],
        isLoading: false
      }
    },
    currentToolCall: {
      ...state.currentToolCall,
      state: 'complete'
    }
  })),

  // Reset tool call state
  resetToolCall: (toolCallId) => set((state) => {
    const { [toolCallId]: _, ...remainingStates } = state.loadingStates
    return {
      loadingStates: remainingStates,
      currentToolCall: {
        toolCallId: null,
        toolName: null,
        state: null
      }
    }
  }),

  // Code view state
  isCodeViewOpen: false,
  setCodeViewOpen: (isOpen) => set({ isCodeViewOpen: isOpen })
}))

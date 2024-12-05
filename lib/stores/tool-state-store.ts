import { create } from 'zustand'

interface ToolCallState {
    isLoading: boolean
    toolName: string
    messageId?: string
    progress?: number
    totalChunks?: number
    collectedContent?: string
}

interface ToolState {
    // Track loading states for each tool call
    loadingStates: Record<string, ToolCallState>

    // Track current tool call progress
    currentToolCall: {
        toolCallId: string | null
        toolName: string | null
        state: 'streaming-start' | 'streaming' | 'delta' | 'complete' | null
        progress?: number
        totalChunks?: number
    }

    // Actions
    startToolCall: (toolCallId: string, toolName: string, messageId?: string) => void
    updateToolCallDelta: (toolCallId: string, delta: string, progress?: number, totalChunks?: number) => void
    completeToolCall: (toolCallId: string) => void
    resetToolCall: (toolCallId: string) => void
    setToolCallProgress: (toolCallId: string, progress: number, totalChunks: number) => void

    // View state management
    isCodeViewOpen: boolean
    setCodeViewOpen: (isOpen: boolean) => void
}

export const useToolState = create<ToolState>((set, get) => ({
    loadingStates: {},
    currentToolCall: {
        toolCallId: null,
        toolName: null,
        state: null,
        progress: 0,
        totalChunks: 0
    },

    // Handle tool call start (streaming-start)
    startToolCall: (toolCallId, toolName, messageId) =>
        set((state) => ({
            loadingStates: {
                ...state.loadingStates,
                [toolCallId]: {
                    isLoading: true,
                    toolName,
                    messageId,
                    progress: 0,
                    totalChunks: 0,
                    collectedContent: ''
                }
            },
            currentToolCall: {
                toolCallId,
                toolName,
                state: 'streaming-start',
                progress: 0,
                totalChunks: 0
            }
        })),

    // Handle tool call delta updates
    updateToolCallDelta: (toolCallId, delta, progress, totalChunks) =>
        set((state) => {
            const currentState = state.loadingStates[toolCallId] || {
                isLoading: true,
                toolName: state.currentToolCall.toolName,
                collectedContent: ''
            }

            return {
                loadingStates: {
                    ...state.loadingStates,
                    [toolCallId]: {
                        ...currentState,
                        collectedContent: currentState.collectedContent + delta,
                        progress,
                        totalChunks
                    }
                },
                currentToolCall: {
                    ...state.currentToolCall,
                    state: 'delta',
                    progress,
                    totalChunks
                }
            }
        }),

    // Handle tool call completion
    completeToolCall: (toolCallId) =>
        set((state) => ({
            loadingStates: {
                ...state.loadingStates,
                [toolCallId]: {
                    ...state.loadingStates[toolCallId],
                    isLoading: false
                }
            },
            currentToolCall: {
                ...state.currentToolCall,
                state: 'complete',
                progress: state.currentToolCall.totalChunks,
            }
        })),

    // Reset tool call state
    resetToolCall: (toolCallId) =>
        set((state) => {
            const { [toolCallId]: _, ...remainingStates } = state.loadingStates
            return {
                loadingStates: remainingStates,
                currentToolCall: {
                    toolCallId: null,
                    toolName: null,
                    state: null,
                    progress: 0,
                    totalChunks: 0
                }
            }
        }),

    // Update progress
    setToolCallProgress: (toolCallId, progress, totalChunks) =>
        set((state) => ({
            loadingStates: {
                ...state.loadingStates,
                [toolCallId]: {
                    ...state.loadingStates[toolCallId],
                    progress,
                    totalChunks
                }
            },
            currentToolCall: {
                ...state.currentToolCall,
                progress,
                totalChunks
            }
        })),

    // Code view state
    isCodeViewOpen: false,
    setCodeViewOpen: (isOpen) => set({ isCodeViewOpen: isOpen })
}))

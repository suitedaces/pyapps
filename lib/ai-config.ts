import { createAI } from 'ai/rsc'
import { completeToolStream, generate, updateToolDelta } from './actions'
import { ReactNode } from 'react'

export type ServerMessage = {
    role: 'user' | 'assistant'
    content: string
}

export type ClientMessage = {
    id: string
    role: 'user' | 'assistant'
    display: ReactNode
}

export type AIState = ServerMessage[]
export type UIState = ClientMessage[]

export const AI = createAI<AIState, UIState>({
    initialUIState: [],
    initialAIState: [],
    actions: {
        generate,
        updateToolDelta,
        completeToolStream,
    },
})

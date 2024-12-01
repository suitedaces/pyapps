// lib/ai-config.ts
import { createAI } from 'ai/rsc'
import { generate, updateToolDelta, completeToolStream } from './actions'

const initialAIState: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    id?: string;
}[] = [];

const initialUIState: {
    id: number;
    display: React.ReactNode;
}[] = [];

export const AI = createAI({
    actions: {
        generate,
        updateToolDelta,
        completeToolStream
    },
    initialUIState,
    initialAIState,
});

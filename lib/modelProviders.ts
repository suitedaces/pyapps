    import { createAnthropic } from '@ai-sdk/anthropic'
    import { LanguageModelV1 } from 'ai'

    export interface LLMModel extends LanguageModelV1 {
        id: string
        name: string
        provider: string
        providerId: string
        multiModal?: boolean
    }


    export type LLMModelConfig = {
        model?: string
        apiKey?: string
        baseURL?: string
        temperature?: number
        topP?: number
        topK?: number
        frequencyPenalty?: number
        presencePenalty?: number
        maxTokens?: number
    }

    export function getModelClient(model: LLMModel, config: LLMModelConfig) {
        const { id: modelNameString, providerId } = model
        const { apiKey, baseURL } = config

        const providerConfigs = {
            anthropic: () => createAnthropic({ apiKey, baseURL })(modelNameString),
        }

        const createClient =
            providerConfigs[providerId as keyof typeof providerConfigs]

        if (!createClient) {
            throw new Error(`Unsupported provider: ${providerId}`)
        }

        return createClient()
    }

    export function getDefaultMode(model: LLMModel) {
        const { id: modelNameString, providerId } = model

        // monkey patch fireworks
        if (providerId === 'anthropic') {
            return 'auto'
        }

        return 'auto'
    }

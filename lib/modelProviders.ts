import { createAnthropic } from '@ai-sdk/anthropic'
import { ModelProvider } from './types'

export interface LLMModel {
  id: string
  name: string
  provider: string
  providerId: string
}

export interface LLMModelConfig {
  model?: string
  apiKey?: string
  baseURL?: string
  temperature?: number
  maxTokens?: number
}

// Provider factory functions with additional methods and properties
export interface AnthropicProvider {
  (modelId: string, settings?: any): ModelProvider
  chat(modelId: string, settings?: any): ModelProvider
}

// Provider settings
export interface AnthropicProviderSettings {
  /**
   * Use a different URL prefix for API calls
   */
  baseURL?: string

  /**
   * API key
   */
  apiKey?: string

  /**
   * Custom headers
   */
  headers?: Record<string, string>
}

// Provider factory function
export function createAnthropicProvider(
  options: AnthropicProviderSettings = {}
): AnthropicProvider {
  const anthropic = createAnthropic({
    apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
    baseURL: options.baseURL,
    headers: options.headers
  })

  const provider = function(modelId: string, settings?: any) {
    if (new.target) {
      throw new Error('Provider factory cannot be called with new')
    }
    return anthropic(modelId)
  }

  provider.chat = anthropic

  return provider as unknown as AnthropicProvider
}

// Default provider instance
export const anthropicProvider = createAnthropicProvider()

export function getModelClient(model: LLMModel, config: LLMModelConfig): ModelProvider {
  console.log('🎯 getModelClient called with:', {
    modelId: model?.id,
    config: config
  })

  if (!model?.id) {
    console.error('❌ No model ID provided')
    throw new Error('Model ID is required')
  }

  const { id: modelId, providerId } = model
  const { apiKey, baseURL } = config

  // Provider configurations
  const providers = {
    anthropic: () => anthropicProvider(modelId, {
      apiKey,
      baseURL
    })
    // Add other providers here as needed
  }

  const createClient = providers[providerId as keyof typeof providers]

  if (!createClient) {
    throw new Error(`Unsupported provider: ${providerId}`)
  }

  return createClient()
}

// Helper function to get default mode for providers
export function getDefaultMode(model: LLMModel) {
  const { providerId } = model

  // Default to 'auto' for most providers
  return 'auto'
}

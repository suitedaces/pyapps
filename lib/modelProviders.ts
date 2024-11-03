import { Anthropic } from '@anthropic-ai/sdk'
import { ModelProvider, StreamParams } from './types'

export class AnthropicProvider implements ModelProvider {
    private client: Anthropic
    private modelId: string

    constructor(apiKey: string, modelId: string) {
        console.log('🔧 Initializing AnthropicProvider with model:', modelId)
        this.client = new Anthropic({ apiKey })
        this.modelId = modelId
    }

    get id(): string {
        return this.modelId
    }

    async streamText(params: StreamParams): Promise<void> {
        console.log('📡 AnthropicProvider.streamText called with:', {
            modelId: this.modelId,
            messageCount: params.messages.length,
            hasTools: Boolean(params.tools?.length)
        })

        try {
            const formattedTools = params.tools?.length ? params.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: {
                    type: 'object',
                    properties: tool.parameters.shape,
                    required: Object.keys(tool.parameters.shape)
                }
            })) : undefined

            if (formattedTools) {
                console.log('🛠 Formatted tools:', JSON.stringify(formattedTools, null, 2))
            }

            const stream = await this.client.messages.create({
                model: this.modelId,
                messages: params.messages.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                })),
                stream: true,
                max_tokens: 4096,
                temperature: 0.7,
                system: params.messages.find(m => m.role === 'system')?.content,
                ...(formattedTools && { tools: formattedTools })
            })

            console.log('🌊 Stream created successfully')

            for await (const chunk of stream) {
                console.log('📦 Received chunk:', chunk.type)

                if (chunk.type === 'content_block_delta' && chunk.delta.text) {
                    console.log('📝 Processing text delta:', chunk.delta.text.substring(0, 50) + '...')
                    params.onToken(chunk.delta.text)
                } else if (chunk.type === 'tool_call') {
                    console.log('🔧 Processing tool call:', chunk.tool_call)
                    if (params.onToolCall) {
                        await params.onToolCall({
                            id: chunk.tool_call.id,
                            name: chunk.tool_call.type === 'function' ? chunk.tool_call.function.name : '',
                            parameters: chunk.tool_call.type === 'function' ?
                                JSON.parse(chunk.tool_call.function.arguments) : {}
                        })
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error in AnthropicProvider.streamText:', error)
            throw error
        }
    }
}

export function getModelClient(model: any, config: any): ModelProvider {
    console.log('🎯 getModelClient called with:', {
        modelId: model?.id,
        config: config
    })

    if (!model?.id) {
        console.error('❌ No model ID provided')
        throw new Error('Model ID is required')
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ANTHROPIC_API_KEY not found in environment')
        throw new Error('ANTHROPIC_API_KEY is required')
    }

    const modelId = typeof model === 'string' ? model : model.id
    console.log('🔑 Creating AnthropicProvider with modelId:', modelId)

    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY, modelId)
}

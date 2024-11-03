import { Anthropic } from '@anthropic-ai/sdk'
import { ModelProvider, ChatParams, StreamParams, ChatResponse } from './types'

export class AnthropicProvider implements ModelProvider {
    private client: Anthropic
    private model: string

    constructor(apiKey: string, model: string) {
        this.client = new Anthropic({ apiKey })
        this.model = model
    }

    async chat(params: ChatParams): Promise<ChatResponse> {
        const response = await this.client.messages.create({
            model: this.model,
            messages: params.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            stream: false
        })

        return {
            content: response.content[0].text,
            usage: {
                prompt_tokens: response.usage.input_tokens,
                completion_tokens: response.usage.output_tokens,
                total_tokens: response.usage.input_tokens + response.usage.output_tokens
            }
        }
    }

    async streamText(params: StreamParams): Promise<void> {
        const stream = await this.client.messages.create({
            model: this.model,
            messages: params.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            stream: true
        })

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.text) {
                params.onToken(chunk.delta.text)
            }
        }
    }
}

export function getModelClient(model: string, config: LLMModelConfig): ModelProvider {
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY!, model)
}

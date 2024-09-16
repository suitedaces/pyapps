import { Anthropic } from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { generateCode } from './tools'
import {
    ClientMessage,
    CSVAnalysis,
    Message,
    StreamChunk,
    Tool,
    ToolCall,
    ToolResult,
} from './types'
import { countTokens } from '@anthropic-ai/tokenizer'

export class GruntyAgent {
    private client: Anthropic
    private model: string
    private role: string
    private roleDescription: string

    constructor(
        client: Anthropic,
        model: string,
        role: string,
        roleDescription: string
    ) {
        this.client = client
        this.model = model
        this.role = role
        this.roleDescription = roleDescription
    }

    private async fetchChatHistory(chatId: string): Promise<Message[]> {
        const supabase = createRouteHandlerClient({ cookies })
        const { data, error } = await supabase.rpc('get_chat_messages', {
            p_chat_id: chatId,
            p_limit: 50,
            p_offset: 0,
        })

        if (error) {
            console.error('Failed to fetch chat history:', error)
            return []
        }

        return data
    }

    async *chat(
        chatId: string,
        userId: string,
        latestMessage: string,
        tools: Tool[],
        temperature: number,
        maxTokens: number,
        csvAnalysis?: CSVAnalysis
    ): AsyncGenerator<StreamChunk> {
        
        const chatHistory = await this.fetchChatHistory(chatId)
        console.log("Chat History:", chatHistory)
        const userMessage: any = {
            role: 'user',
            content: latestMessage
        }
        
        const sanitizedMessages = this.prepareMessagesForAnthropicAPI(chatHistory)

        sanitizedMessages.push(userMessage)

        console.log("Sanitized Messages:", sanitizedMessages)


        const stream = await this.client.messages.stream({
            model: this.model,
            system: this.roleDescription,
            messages: sanitizedMessages,
            max_tokens: maxTokens,
            tools,
        })

        let currentMessage: any = null
        let currentContentBlock: any = null
        let accumulatedJson = ''
        let accumulatedResponse = ''
        let generatedCode = ''
        let toolCalls: ToolCall[] | null = null
        let toolResults: ToolResult[] | null = null

        for await (const event of stream) {
            yield event as StreamChunk
            if (event.type === 'message_start') {
                currentMessage = event.message
            } else if (event.type === 'content_block_start') {
                currentContentBlock = event.content_block
                accumulatedJson = ''
            } else if (event.type === 'content_block_delta') {
                if (
                    currentContentBlock.type === 'text' &&
                    event.delta.type === 'text_delta'
                ) {
                    currentContentBlock.text =
                        (currentContentBlock.text || '') + event.delta.text
                    accumulatedResponse += event.delta.text
                } else if (
                    currentContentBlock.type === 'tool_use' &&
                    event.delta.type === 'input_json_delta'
                ) {
                    accumulatedJson += event.delta.partial_json
                }
            } else if (event.type === 'content_block_stop') {
                if (currentContentBlock.type === 'tool_use') {
                    currentContentBlock.input = accumulatedJson
                    currentMessage.content.push(currentContentBlock)
                    toolCalls = toolCalls || []
                    toolCalls.push(currentContentBlock)
                    if (currentContentBlock.name === 'create_streamlit_app') {
                        try {
                            const toolInput = JSON.parse(accumulatedJson)
                            const codeQuery = `
                                ${toolInput.query}
                                Use the following CSV analysis to inform your code:
                                ${JSON.stringify(csvAnalysis, null, 2)}
                            `
                            generatedCode = await generateCode(codeQuery)

                            yield {
                                type: 'generated_code',
                                content: generatedCode,
                            } as unknown as StreamChunk

                            toolResults = toolResults || []
                            toolResults.push({
                                name: 'create_streamlit_app',
                                result: generatedCode,
                            })
                        } catch (error) {
                            console.error(
                                'Error parsing JSON or generating Streamlit code:',
                                error
                            )
                            yield {
                                type: 'error',
                                content: 'Error in code generation process',
                            } as unknown as StreamChunk
                        }
                    }
                }
                currentContentBlock = null
            } else if (event.type === 'message_delta') {
                Object.assign(currentMessage, event.delta)
            } else if (event.type === 'message_stop') {

                await this.storeMessage(
                    chatId,
                    userId,
                    latestMessage,
                    accumulatedResponse.trim(),
                    this.calculateTokenCount(accumulatedResponse),
                    toolCalls,
                    toolResults
                )

                currentMessage = null
                accumulatedResponse = ''
                generatedCode = ''
                toolCalls = null
                toolResults = null
            }
        }
    }

    private async storeMessage(
        chatId: string,
        userId: string,
        userMessage: string,
        assistantMessage: string,
        tokenCount: number,
        toolCalls: any,
        toolResults: any
    ) {
        const supabase = createRouteHandlerClient({ cookies })
        const { error } = await supabase.rpc('insert_message', {
            p_chat_id: chatId,
            p_user_id: userId,
            p_user_message: userMessage,
            p_assistant_message: assistantMessage,
            p_token_count: tokenCount,
            p_tool_calls: toolCalls,
            p_tool_results: toolResults,
        })

        if (error) {
            console.error('Failed to store message:', error)
        }
    }

    private calculateTokenCount(text: string): number {
        return countTokens(text)
    }

    private prepareMessagesForAnthropicAPI(messages: Message[]): Anthropic.Messages.MessageParam[] {
        const sanitizedMessages: Anthropic.Messages.MessageParam[] = [];
    
        for (const message of messages) {
            sanitizedMessages.push({
                role: 'user',
                content: message.user_message
            });
    
            // Process assistant messages
            const assistantMessage: Anthropic.Messages.MessageParam = {
                role: 'assistant',
                content: message.assistant_message
            };
    
            if (message.tool_calls) {
                const toolCalls = message.tool_calls as ToolCall[];
                assistantMessage.content = [
                    { type: 'text', text: message.assistant_message },
                    ...toolCalls.map(call => ({
                        type: 'tool_use' as const,
                        id: call.id ?? '',
                        name: call.name,
                        input: call.parameters
                    }))
                ];
            }
    
            sanitizedMessages.push(assistantMessage);
    
            if (message.tool_results) {
                const toolResults = message.tool_results as ToolResult[];
                for (const result of toolResults) {
                    sanitizedMessages.push({
                        role: 'user', // Set role to 'user' for tool results
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: result.id || '',
                                content: JSON.stringify(result.result)
                            }
                        ]
                    });
                }
            }
        }
    
        return sanitizedMessages;
    }

}
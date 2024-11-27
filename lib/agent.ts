import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { CoreMessage as VercelMessage } from 'ai'
import { cookies } from 'next/headers'
import { messageStore } from './messageStore'
import { getToolByName } from './tools'
import { streamText, LanguageModelV1, CoreMessage } from 'ai'
import {
    ModelProvider,
    Tool,
    LLMModelConfig,
    ToolInvocation as GruntyToolInvocation
} from './types'
import { encode } from 'gpt-tokenizer'
import { createVersion } from '@/lib/supabase'
import { useToolState } from '@/lib/stores/tool-state-store'

interface FileContext {
    fileName: string;
    fileType: string;
    content?: string;
    analysis?: any;
}

// Helper functions to log tool call states
function logToolCallStart(data: any) {
    console.log('🟡 Tool Call Start (b:)', {
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        timestamp: new Date().toISOString(),
        state: 'streaming'
    });
}

function logToolCallDelta(data: any) {
    console.log('🔵 Tool Call Delta (c:)', {
        toolCallId: data.toolCallId,
        argsTextDelta: data.argsTextDelta,
        timestamp: new Date().toISOString(),
        state: 'delta'
    });
}

function logToolCallComplete(data: any) {
    console.log('✅ Tool Call Complete (9:)', {
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        args: data.args,
        timestamp: new Date().toISOString(),
        state: 'complete'
    });
}

// Main agent class that handles chat streaming and tool execution
export class GruntyAgent {
    private model: ModelProvider
    private role: string
    private roleDescription: string
    private config: LLMModelConfig
    private sanitizedMessages: CoreMessage[] = []
    private fileContext?: FileContext

    constructor(
        modelClient: ModelProvider,
        role: string,
        roleDescription: string,
        config: LLMModelConfig
    ) {
        this.model = modelClient
        this.role = role
        this.roleDescription = roleDescription
        this.config = config
    }

    // Main method to handle streaming responses and tool execution
    async streamResponse(
        chatId: string,
        userId: string,
        messages: CoreMessage[],
        tools: Tool[],
        fileContext?: FileContext
    ) {
        this.fileContext = fileContext
        this.sanitizedMessages = []

        // Add system message with file context if available
        const systemMessage = fileContext
            ? `${this.roleDescription}\n\nYou are working with a ${fileContext.fileType.toUpperCase()} file named "${fileContext.fileName}".`
            : this.roleDescription

        this.sanitizedMessages.push({
            role: 'system',
            content: systemMessage
        })

        // Fetch complete conversation history
        const supabase = createRouteHandlerClient({ cookies })
        const { data: messageHistory, error: historyError } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

        if (historyError) {
            console.error('❌ Error fetching message history:', historyError)
        }

        // Process message history
        if (messageHistory) {
            this.processMessageHistory(messageHistory)
        }

        // Add the latest user message
        const latestUserMessage = messages[messages.length - 1]
        if (latestUserMessage.role === 'user') {
            this.sanitizedMessages.push({
                role: 'user',
                content: latestUserMessage.content
            })
        }

        // Set up streaming
        const encoder = new TextEncoder()
        const stream = new TransformStream()
        const writer = stream.writable.getWriter()

        // Start streaming process
        this.handleStreamProcess(writer, encoder, tools, chatId, userId)

        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'x-vercel-ai-data-stream': 'v1',
                'x-chat-id': chatId
            },
        })
    }

    private async handleStreamProcess(
        writer: WritableStreamDefaultWriter,
        encoder: TextEncoder,
        tools: Tool[],
        chatId: string,
        userId: string
    ) {
        try {
            let collectedContent = ''

            // Set up tools for the model
            const formattedTools = this.formatTools(tools)

            // Start the stream
            const { textStream, fullStream } = await streamText({
                model: this.model as unknown as LanguageModelV1,
                messages: this.sanitizedMessages,
                tools: formattedTools,
                temperature: this.config.temperature || 0.7,
                maxTokens: this.config.maxTokens || 4096,
                experimental_toolCallStreaming: true,
            })

            // Handle text chunks
            for await (const chunk of textStream) {
                collectedContent += chunk
                const textPart = `0:${JSON.stringify(chunk)}\n\n`
                writer.write(encoder.encode(textPart))
            }

            // Process the full stream with tools
            await this.processFullStream(
                fullStream,
                writer,
                encoder,
                collectedContent,
                chatId,
                userId
            )

        } catch (error) {
            console.error('🔥 Stream process error:', error)
            throw error
        } finally {
            writer.close()
        }
    }

    // Prepare tools for the model - we're not executing here to avoid double generation
    private formatTools(tools: Tool[]) {
        return tools.reduce((acc, tool) => {
            acc[tool.toolName] = {
                description: tool.description,
                parameters: tool.parameters,
                execute: null
            }
            return acc
        }, {} as Record<string, any>)
    }

    private calculateTokenCount(text: string): number {
        return encode(text).length
    }

    private async storeMessage(
        chatId: string,
        userId: string,
        message: {
            user_message: string
            assistant_message: string
            tool_calls: any[]
            tool_results: any[]
        }
    ) {
        console.log('💾 Attempting to store message:', {
            chatId,
            userId,
            messagePreview: {
                user: message.user_message,
                assistant: message.assistant_message,
                toolCalls: message.tool_calls.length,
                toolResults: message.tool_results.length
            }
        })

        const supabase = createRouteHandlerClient({ cookies })

        try {
            // Clean the assistant message by removing the metadata
            const cleanedAssistantMessage = message.assistant_message.replace(
                /d:{"finishReason":"[^"]+","usage":{[^}]+}}$/,
                ''
            )

            const userTokens = this.calculateTokenCount(message.user_message)
            const assistantTokens = this.calculateTokenCount(cleanedAssistantMessage)
            const toolCallTokens = message.tool_calls?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_calls))
                : 0
            const toolResultTokens = message.tool_results?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_results))
                : 0

            const totalTokens = userTokens + assistantTokens + toolCallTokens + toolResultTokens

            console.log('🔢 Token counts:', {
                user: userTokens,
                assistant: assistantTokens,
                toolCalls: toolCallTokens,
                toolResults: toolResultTokens,
                total: totalTokens
            })

            const messageData = {
                chat_id: chatId,
                user_id: userId,
                user_message: message.user_message,
                assistant_message: cleanedAssistantMessage,
                tool_calls: message.tool_calls.length > 0 ? message.tool_calls : null,
                tool_results: message.tool_results.length > 0 ? message.tool_results : null,
                created_at: new Date().toISOString(),
                token_count: totalTokens
            }

            const { data, error } = await supabase
                .from('messages')
                .insert(messageData)
                .select()

            if (error) {
                console.error(' Failed to store message:', error)
                throw error
            }

            console.log('✅ Message stored successfully:', {
                messageId: data[0]?.id,
                timestamp: data[0]?.created_at
            })
            return data
        } catch (error) {
            console.error('❌ Error in storeMessage:', error)
            throw error
        }
    }

    private processMessageHistory(messageHistory: any[]) {
        console.log('📝 Processing message history:', {
            messageCount: messageHistory.length
        })

        messageHistory.forEach(msg => {
            if (msg.user_message) {
                this.sanitizedMessages.push({
                    role: 'user',
                    content: msg.user_message
                })
                console.log('➕ Added user message:', {
                    timestamp: msg.created_at,
                    contentPreview: msg.user_message.substring(0, 50) + '...'
                })
            }
            if (msg.assistant_message) {
                this.sanitizedMessages.push({
                    role: 'assistant',
                    content: msg.assistant_message
                })
                console.log('➕ Added assistant message:', {
                    timestamp: msg.created_at,
                    contentPreview: msg.assistant_message.substring(0, 50) + '...'
                })
            }
        })

        console.log('✅ Message history processed:', {
            totalMessages: this.sanitizedMessages.length
        })
    }

    private async processFullStream(
        fullStream: any,
        writer: WritableStreamDefaultWriter,
        encoder: TextEncoder,
        collectedContent: string,
        chatId: string,
        userId: string
    ) {
        let toolCalls: any[] = [];
        let toolResults: any[] = [];
        let appId: string | null = null;

        try {
            // First check if chat already has an associated app
            const supabase = createRouteHandlerClient({ cookies })
            const { data: existingChat } = await supabase
                .from('chats')
                .select('app_id')
                .eq('id', chatId)
                .single()

            appId = existingChat?.app_id

            // Extract CSV filename from messages
            let csvFileName = 'data.csv'; // default fallback
            if (this.fileContext?.fileName) {
                csvFileName = this.fileContext.fileName;
            } else {
                // Try to find CSV filename in user messages
                const csvFileNameMatch = this.sanitizedMessages
                    .filter(msg => msg.role === 'user')
                    .map(msg => {
                        const content = typeof msg.content === 'string'
                            ? msg.content
                            : Array.isArray(msg.content)
                                ? msg.content.map(part =>
                                    typeof part === 'string' ? part : ''
                                ).join(' ')
                                : '';

                        const match = content.match(/['"]([\w\s-]+\.csv)['"]/i);
                        return match ? match[1] : null;
                    })
                    .find(name => name !== null);

                if (csvFileNameMatch) {
                    csvFileName = csvFileNameMatch;
                }
            }

            // Use the CSV filename (without extension) as the base for the app name
            const baseAppName = csvFileName.replace('.csv', '');

            for await (const step of fullStream) {
                if (step.type === 'tool-call' && step.toolName === 'create_streamlit_app') {
                    try {
                        const toolCallId = step.toolCallId;
                        const toolName = step.toolName;
                        const args = step.args || {};

                        // Get the tool executor
                        const tool = getToolByName(toolName);
                        if (!tool) {
                            throw new Error(`Tool ${toolName} not found`);
                        }

                        // Let the UI know we're starting
                        const toolCallStartData = {
                            toolCallId,
                            toolName,
                            args
                        };
                        writer.write(encoder.encode(`b:${JSON.stringify(toolCallStartData)}\n\n`));

                        // Run the tool
                        const result = await tool.execute({
                            query: args.query,
                            fileContext: {
                                fileName: args.fileContext?.fileName || this.fileContext?.fileName,
                                fileType: args.fileContext?.fileType || this.fileContext?.fileType,
                                analysis: args.fileContext?.analysis || this.fileContext?.analysis
                            }
                        });

                        // Create or update app and version
                        if (result.generatedCode) {
                            if (!appId) {
                                const { data: newApp, error: appError } = await supabase
                                    .from('apps')
                                    .insert({
                                        user_id: userId,
                                        name: baseAppName,
                                        description: args.query,
                                        is_public: false,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                        created_by: userId,
                                    })
                                    .select()
                                    .single();

                                if (appError) throw appError;
                                appId = newApp.id;

                                // Link chat to app
                                await supabase
                                    .from('chats')
                                    .update({ app_id: appId })
                                    .eq('id', chatId);
                            }

                            if (!appId) {
                                throw new Error('Failed to create or retrieve app ID');
                            }

                            // Create new version
                            try {
                                const versionData = await createVersion(appId, result.generatedCode);
                                console.log('Version created successfully:', versionData);
                            } catch (versionError) {
                                console.error('Failed to create version:', versionError);
                                throw versionError;
                            }
                        }

                        // Mark as complete
                        const toolCallCompleteData = {
                            toolCallId,
                            toolName,
                            args
                        };
                        writer.write(encoder.encode(`9:${JSON.stringify(toolCallCompleteData)}\n\n`));

                        // Send back the result
                        writer.write(encoder.encode(`a:${JSON.stringify({
                            toolCallId,
                            result: result.generatedCode
                        })}\n\n`));

                        // Keep track of what happened
                        toolCalls.push({
                            id: toolCallId,
                            name: toolName,
                            args: args
                        });

                        toolResults.push({
                            id: toolCallId,
                            name: toolName,
                            result: result.generatedCode
                        });

                    } catch (error) {
                        console.error('Error in tool call processing:', error);
                        const errorResult = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        writer.write(encoder.encode(`a:${JSON.stringify({
                            toolCallId: step.toolCallId,
                            result: errorResult
                        })}\n\n`));
                    }
                } else if (step.type === 'text-delta') {
                    if (step.text || step.content) {
                        const textContent = step.text || step.content;
                        const textData = `0:${JSON.stringify(textContent)}\n\n`;
                        writer.write(encoder.encode(textData));
                        collectedContent += textContent;
                    }
                } else if (step.type === 'finish') {
                    if (collectedContent) {
                        const latestUserMessage = this.sanitizedMessages
                            .filter(msg => msg.role === 'user')
                            .pop();

                        // Store the complete message
                        await this.storeMessage(chatId, userId, {
                            user_message: typeof latestUserMessage?.content === 'string'
                                ? latestUserMessage.content
                                : '',
                            assistant_message: collectedContent,
                            tool_calls: toolCalls,
                            tool_results: toolResults
                        });

                        // Send completion signal
                        const finishData = `d:${JSON.stringify({
                            finishReason: step.finishReason || 'stop',
                            usage: {
                                promptTokens: step.usage?.promptTokens || 0,
                                completionTokens: step.usage?.completionTokens || 0,
                                totalTokens: (step.usage?.promptTokens || 0) + (step.usage?.completionTokens || 0)
                            }
                        })}\n\n`;
                        writer.write(encoder.encode(finishData));
                    }
                }
            }
        } catch (error) {
            console.error('Stream processing failed:', {
                chatId,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }
}

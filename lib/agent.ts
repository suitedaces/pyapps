import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { CoreMessage as VercelMessage } from 'ai'
import { cookies } from 'next/headers'
import { messageStore } from './messageStore'
import { toolRegistry } from './tools/registry'
import { streamText, LanguageModelV1, CoreMessage } from 'ai'
import {
    ModelProvider,
    Tool,
    LLMModelConfig,
    StreamingTool,
} from './types'
import { encode } from 'gpt-tokenizer'
import { createVersion } from '@/lib/supabase'

interface FileContext {
    fileName: string;
    fileType: string;
    content?: string;
    analysis?: any;
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
        tools: (Tool | StreamingTool)[],
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

        // Process message history
        await this.processMessageHistory(chatId)

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
        tools: (Tool | StreamingTool)[],
        chatId: string,
        userId: string
    ) {
        try {
            let collectedContent = ''
            console.log('🚀 Starting stream process');

            // Set up tools for the model
            const formattedTools = tools.reduce((acc, tool) => {
                acc[tool.toolName] = {
                    description: tool.description,
                    parameters: tool.parameters,
                    execute: null
                }
                return acc
            }, {} as Record<string, any>)

            console.log('🛠️ Formatted tools:', {
                toolCount: Object.keys(formattedTools).length,
                tools: Object.keys(formattedTools)
            });

            // Start the stream
            const { textStream, fullStream } = await streamText({
                model: this.model as unknown as LanguageModelV1,
                messages: this.sanitizedMessages,
                tools: formattedTools,
                temperature: this.config.temperature || 0.7,
                maxTokens: this.config.maxTokens || 4096,
                experimental_toolCallStreaming: true,
            })

            console.log('📡 Stream started');

            // Handle text chunks - THIS IS THE KEY PART WE NEED TO FIX
            for await (const chunk of textStream) {
                console.log('📝 Received text chunk:', { chunk });

                // Immediately stream the chunk to the client
                const textPart = `0:${JSON.stringify(chunk)}\n\n`
                await writer.write(encoder.encode(textPart))

                // Also collect for storage
                collectedContent += chunk
            }

            console.log('📝 Assistant message complete:', {
                contentLength: collectedContent.length,
                preview: collectedContent.substring(0, 100) + '...'
            });

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

    private async processFullStream(
        fullStream: any,
        writer: WritableStreamDefaultWriter,
        encoder: TextEncoder,
        collectedContent: string,
        chatId: string,
        userId: string
    ) {
        let toolCalls: any[] = []
        let toolResults: any[] = []
        let appId: string | null = null;
        const versionCreatedForToolCall = new Set<string>();

        try {
            // First check if chat already has an associated app
            const supabase = createRouteHandlerClient({ cookies })
            const { data: existingChat } = await supabase
                .from('chats')
                .select('app_id')
                .eq('id', chatId)
                .single()

            appId = existingChat?.app_id

            // Extract CSV filename from messages or context
            let csvFileName = this.fileContext?.fileName || 'data.csv';
            if (!this.fileContext?.fileName) {
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
                console.log('🔄 Processing stream step:', { type: step.type });

                if (step.type === 'tool-call') {
                    try {
                        const toolCallId = step.toolCallId;
                        const toolName = step.toolName;
                        const args = step.args || {};

                        console.log('️ Tool call started:', {
                            toolCallId,
                            toolName,
                            args
                        });

                        const tool = toolRegistry.get(toolName);
                        if (!tool) {
                            throw new Error(`Tool ${toolName} not found`);
                        }

                        // Send tool call start
                        writer.write(encoder.encode(`b:${JSON.stringify({
                            toolCallId,
                            toolName,
                            args
                        })}\n\n`));

                        // Stream tool execution
                        for await (const part of toolRegistry.streamToolExecution(
                            toolCallId,
                            toolName,
                            { ...args, fileContext: this.fileContext }
                        )) {
                            console.log('📦 Processing tool stream part:', {
                                type: part.type,
                                toolCallId: part.toolCallId,
                                contentLength: 'argsTextDelta' in part ? part.argsTextDelta.length : undefined
                            });

                            switch (part.type) {
                                case 'tool-call-delta':
                                    writer.write(encoder.encode(`c:${JSON.stringify({
                                        toolCallId,
                                        argsTextDelta: part.argsTextDelta
                                    })}\n\n`));
                                    break;

                                case 'tool-result':
                                    // Handle app and version creation specifically for create_streamlit_app
                                    if (part.result &&
                                        typeof part.result === 'string' &&
                                        toolName === 'create_streamlit_app' &&
                                        !versionCreatedForToolCall.has(toolCallId)) {

                                        if (!appId) {
                                            const { data: newApp, error: appError } = await supabase
                                                .from('apps')
                                                .insert({
                                                    user_id: userId,
                                                    name: baseAppName,
                                                    description: args.query || 'Generated App',
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
                                            const versionData = await createVersion(appId, part.result);
                                            versionCreatedForToolCall.add(toolCallId);

                                            console.log('✅ Version created successfully:', {
                                                appId,
                                                versionNumber: versionData.version_number,
                                                toolName,
                                                toolCallId
                                            });
                                        } catch (versionError) {
                                            console.error('❌ Failed to create version:', versionError);
                                            throw versionError;
                                        }
                                    }

                                    // Send tool call completion first
                                    writer.write(encoder.encode(`9:${JSON.stringify({
                                        toolCallId,
                                        toolName,
                                        args
                                    })}\n\n`));

                                    // Then send tool result
                                    writer.write(encoder.encode(`a:${JSON.stringify({
                                        toolCallId,
                                        result: part.result
                                    })}\n\n`));

                                    // Track result
                                    toolResults.push({
                                        id: toolCallId,
                                        name: toolName,
                                        result: part.result
                                    });
                                    break;
                            }
                        }

                        // Track tool call
                        toolCalls.push({
                            id: toolCallId,
                            name: toolName,
                            args: args
                        });

                    } catch (error) {
                        console.error('❌ Error in tool execution:', error);
                        writer.write(encoder.encode(`e:${JSON.stringify({
                            toolCallId: step.toolCallId,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        })}\n\n`));
                    }
                }
            }

            // Store the complete message
            if (collectedContent) {
                const latestUserMessage = this.sanitizedMessages
                    .filter(msg => msg.role === 'user')
                    .pop();

                // Handle different content types according to Vercel's protocol
                const getUserMessageContent = (message: any): string => {
                    if (!message?.content) return '';

                    if (typeof message.content === 'string') {
                        return message.content;
                    }

                    if (Array.isArray(message.content)) {
                        return message.content
                            .map((part: { type: string; text: any }) => {
                                if (typeof part === 'string') return part;
                                if ('type' in part && part.type === 'text') {
                                    return part.text;
                                }
                                return '';
                            })
                            .filter(Boolean)
                            .join(' ');
                    }

                    return '';
                };

                const userMessageContent = getUserMessageContent(latestUserMessage);

                console.log('📝 Processing user message:', {
                    originalContent: latestUserMessage?.content,
                    processedContent: userMessageContent
                });

                await this.storeMessage(chatId, userId, {
                    user_message: userMessageContent,
                    assistant_message: collectedContent,
                    tool_calls: toolCalls,
                    tool_results: toolResults
                });
            }

        } catch (error) {
            console.error('Stream processing failed:', error);
            throw error;
        }
    }

    private async processMessageHistory(chatId: string): Promise<void> {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: messageHistory, error: historyError } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

        if (historyError) {
            console.error('❌ Error fetching message history:', historyError)
            return
        }

        if (messageHistory) {
            messageHistory.forEach(msg => {
                if (msg.user_message) {
                    this.sanitizedMessages.push({
                        role: 'user',
                        content: msg.user_message
                    })
                }
                if (msg.assistant_message) {
                    this.sanitizedMessages.push({
                        role: 'assistant',
                        content: msg.assistant_message
                    })
                }
            })
        }
    }

    private calculateTokenCount(text: string): number {
        return encode(text).length;
    }

    private async storeMessage(
        chatId: string,
        userId: string,
        message: {
            user_message: string | { content: string };
            assistant_message: string;
            tool_calls: any[];
            tool_results: any[];
        }
    ): Promise<void> {
        const supabase = createRouteHandlerClient({ cookies })

        try {
            // Calculate token counts
            const userMessageContent = typeof message.user_message === 'string'
                ? message.user_message
                : message.user_message.content;

            const userTokens = this.calculateTokenCount(userMessageContent);
            const assistantTokens = this.calculateTokenCount(message.assistant_message);
            const toolCallTokens = message.tool_calls?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_calls))
                : 0;
            const toolResultTokens = message.tool_results?.length
                ? this.calculateTokenCount(JSON.stringify(message.tool_results))
                : 0;

            const totalTokens = userTokens + assistantTokens + toolCallTokens + toolResultTokens;

            console.log('🔢 Token counts:', {
                user: userTokens,
                assistant: assistantTokens,
                toolCalls: toolCallTokens,
                toolResults: toolResultTokens,
                total: totalTokens
            });

            const messageData = {
                chat_id: chatId,
                user_id: userId,
                user_message: message.user_message,
                assistant_message: message.assistant_message,
                tool_calls: message.tool_calls.length > 0 ? message.tool_calls : null,
                tool_results: message.tool_results.length > 0 ? message.tool_results : null,
                created_at: new Date().toISOString(),
                token_count: totalTokens
            }

            const { error } = await supabase
                .from('messages')
                .insert(messageData)

            if (error) {
                console.error('Failed to store message:', error)
                throw error
            }

            console.log('✅ Message stored successfully:', {
                chatId,
                userId,
                tokenCount: totalTokens
            });

        } catch (error) {
            console.error('Error in storeMessage:', error)
            throw error
        }
    }
}

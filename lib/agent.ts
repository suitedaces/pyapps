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

        try {
            for await (const step of fullStream) {
                try {
                    if (step.type === 'text-delta') {
                        // Handle regular text responses
                        const textContent = step.text || step.content || '';
                        if (textContent) {
                            const textData = `0:${JSON.stringify(textContent)}\n\n`
                            writer.write(encoder.encode(textData))
                            collectedContent += textContent
                        }
                    } else if (step.type === 'tool-call' && step.toolName === 'create_streamlit_app') {
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
                            logToolCallStart(toolCallStartData);
                            writer.write(encoder.encode(`b:${JSON.stringify(toolCallStartData)}\n\n`));

                            // Send progress update
                            const deltaData = {
                                toolCallId,
                                argsTextDelta: typeof args === 'string' ? args : JSON.stringify(args)
                            };
                            logToolCallDelta(deltaData);
                            writer.write(encoder.encode(`c:${JSON.stringify(deltaData)}\n\n`));

                            // Run the tool
                            const result = await tool.execute({
                                query: args.query,
                                fileContext: {
                                    fileName: args.fileContext?.fileName || this.fileContext?.fileName,
                                    fileType: args.fileContext?.fileType || this.fileContext?.fileType,
                                    analysis: args.fileContext?.analysis || this.fileContext?.analysis
                                }
                            });

                            // Mark as complete
                            const toolCallCompleteData = {
                                toolCallId,
                                toolName,
                                args
                            };
                            logToolCallComplete(toolCallCompleteData);
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
                            throw error;
                        }
                    } else if (step.type === 'finish') {
                        if (collectedContent) {
                            const latestUserMessage = this.sanitizedMessages
                                .filter(msg => msg.role === 'user')
                                .pop()

                            // Save everything to the database
                            await this.storeMessage(chatId, userId, {
                                user_message: typeof latestUserMessage?.content === 'string'
                                    ? latestUserMessage.content
                                    : '',
                                assistant_message: collectedContent,
                                tool_calls: toolCalls,
                                tool_results: toolResults
                            })

                            // Send completion signal
                            const finishData = `d:${JSON.stringify({
                                finishReason: step.finishReason || 'stop',
                                usage: {
                                    promptTokens: step.usage?.promptTokens || 0,
                                    completionTokens: step.usage?.completionTokens || 0,
                                    totalTokens: (step.usage?.promptTokens || 0) + (step.usage?.completionTokens || 0)
                                }
                            })}\n\n`
                            writer.write(encoder.encode(finishData))
                        }
                    }
                } catch (error) {
                    console.error('Error processing stream step:', error);
                    throw error;
                }
            }
        } catch (error) {
            console.error('Stream processing failed:', error);
            throw error;
        }
    }
}

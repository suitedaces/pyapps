import { Anthropic } from '@anthropic-ai/sdk';
import { Message, ToolResult, StreamChunk, CSVAnalysis } from './types';
import { generateCode } from './tools';
import { Tool } from './types';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export class GruntyAgent {
  private client: Anthropic;
  private model: string;
  private role: string;
  private roleDescription: string;
  private messages: Message[];

  constructor(
    client: Anthropic,
    model: string,
    role: string,
    roleDescription: string
  ) {
    this.client = client;
    this.model = model;
    this.role = role;
    this.roleDescription = roleDescription;
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
    const messages = this.buildChatHistory();
    const userMessage: Message = { 
      role: 'user', 
      content: latestMessage, 
      created_at: new Date() 
    };
    messages.push(userMessage);
    this.messages.push(userMessage);

    // Store the user message in the database
    await this.storeMessage(chatId, userId, latestMessage, '', 0, null, null);

    const sanitizedMessages = this.ensureAlternatingMessages(messages);

    const stream = await this.client.messages.stream({
      model: this.model,
      system: this.roleDescription,
      messages: sanitizedMessages,
      max_tokens: maxTokens,
      tools,
    });

    let currentMessage: any = null;
    let currentContentBlock: any = null;
    let accumulatedJson = '';
    let accumulatedResponse = '';
    let generatedCode = '';
    let toolCalls = null;
    let toolResults = null;
  
    for await (const event of stream) {
      yield event as StreamChunk;
  
      if (event.type === 'message_start') {
        currentMessage = event.message;
      } else if (event.type === 'content_block_start') {
        currentContentBlock = event.content_block;
        accumulatedJson = '';
      } else if (event.type === 'content_block_delta') {
        if (currentContentBlock.type === 'text' && event.delta.type === 'text_delta') {
          currentContentBlock.text = (currentContentBlock.text || '') + event.delta.text;
          accumulatedResponse += event.delta.text;
        } else if (currentContentBlock.type === 'tool_use' && event.delta.type === 'input_json_delta') {
          accumulatedJson += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentContentBlock.type === 'tool_use') {
          currentContentBlock.input = accumulatedJson;
          currentMessage.content.push(currentContentBlock);
          toolCalls = toolCalls || [];
          toolCalls.push(currentContentBlock);
          if (currentContentBlock.name === 'create_streamlit_app') {
            try {
              const toolInput = JSON.parse(accumulatedJson);
              const codeQuery = `
                Create a Streamlit app that ${toolInput.query}
                Use the following CSV analysis to inform your code:
                ${JSON.stringify(csvAnalysis, null, 2)}
              `;
              generatedCode = await generateCode(codeQuery);
              
              yield {
                type: 'generated_code',
                content: generatedCode,
              } as unknown as StreamChunk;

              toolResults = toolResults || [];
              toolResults.push({
                name: 'create_streamlit_app',
                result: generatedCode
              });
            } catch (error) {
              console.error('Error parsing JSON or generating Streamlit code:', error);
              yield {
                type: 'error',
                content: 'Error in code generation process',
              } as unknown as StreamChunk;
            }
          }
        }
        currentContentBlock = null;
      } else if (event.type === 'message_delta') {
        Object.assign(currentMessage, event.delta);
      } else if (event.type === 'message_stop') {
        let fullResponse = accumulatedResponse;

        if (generatedCode) {
          fullResponse += `\n\nI've generated the following Streamlit code based on your request:\n\n\`\`\`python\n${generatedCode}\n\`\`\``;
        }

        // Store the assistant's response in the database
        await this.storeMessage(chatId, userId, latestMessage, fullResponse.trim(), this.calculateTokenCount(fullResponse), toolCalls, toolResults);

        currentMessage = null;
        accumulatedResponse = '';
        generatedCode = '';
        toolCalls = null;
        toolResults = null;
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
      p_tool_results: toolResults
    })

    if (error) {
      console.error('Failed to store message:', error);
    }
  }

  private calculateTokenCount(text: string): number {
    // This is a very rough estimate. For more accurate results,
    // you should use a proper tokenizer that matches the model's tokenization.
    return text.split(/\s+/).length;
  }

  private ensureAlternatingMessages(messages: Message[]): any[] {
    if (messages.length === 0) return [];

    const result: Message[] = [];
    let lastRole: 'user' | 'assistant' | null = null;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (message.role === 'user') {
        if (lastRole === 'user') {
          result[result.length - 1].content += '\n\n' + message.content;
        } else {
          result.push(message);
        }
        lastRole = 'user';
      } else if (message.role === 'assistant' && lastRole === 'user') {
        result.push(message);
        lastRole = 'assistant';
      }
    }

    if (result.length > 0 && result[result.length - 1].role === 'assistant') {
      result.pop();
    }

    return result.map(message => ({
      role: message.role,
      content: message.content,
    }));
  }
}
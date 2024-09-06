import { Anthropic } from '@anthropic-ai/sdk';
import { Message, ToolResult, StreamChunk, CSVAnalysis } from './types';
import { generateCode } from './tools';
import { Tool } from './types';

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
    this.messages = [];
  }

  async *chat(
    latestMessage: string,
    tools: Tool[],
    temperature: number,
    maxTokens: number,
    csvAnalysis?: CSVAnalysis
  ): AsyncGenerator<StreamChunk> {
  // Ensure the history is built before the new message
  const messages = this.buildChatHistory();
  console.log('Chat history before the stream:', this.messages);
  // Add created_at to the new user message
  const userMessage: Message = { 
    role: 'user', 
    content: latestMessage, 
    created_at: new Date() 
  };
  messages.push(userMessage);

  // Store the latest message into the agent's history
  this.messages.push(userMessage);

  const sanitizedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const stream = await this.client.messages.stream({
      model: this.model,
      system: this.roleDescription,
      messages: sanitizedMessages,
      temperature,
      max_tokens: maxTokens,
      tools,
    });

    let currentMessage: any = null;
    let currentContentBlock: any = null;

    for await (const event of stream) {
      console.log('Received stream chunk:', event);
      yield event as StreamChunk;

      if (event.type === 'message_start') {
        currentMessage = event.message;
      } else if (event.type === 'content_block_start') {
        currentContentBlock = event.content_block;
      } else if (event.type === 'content_block_delta') {
        if (currentContentBlock.type === 'text' && event.delta.type === 'text_delta') {
          currentContentBlock.text = (currentContentBlock.text || '') + event.delta.text;
        } else if (currentContentBlock.type === 'tool_use' && event.delta.type === 'input_json_delta') {
          currentContentBlock.input = (currentContentBlock.input || '') + event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentContentBlock.type === 'tool_use') {
          currentMessage.content.push(currentContentBlock);
          if (currentContentBlock.name === 'create_streamlit_app') {
            const toolInput = JSON.parse(currentContentBlock.input);
            const codeQuery = `
              Create a Streamlit app that ${toolInput.query}
              Use the following CSV analysis to inform your code:
              ${JSON.stringify(csvAnalysis, null, 2)}
            `;
            try {
              const generatedCode = await generateCode(codeQuery);
              yield {
                  type: 'generated_code',
                  content: generatedCode,
              } as unknown as StreamChunk;
            } catch (error) {
              console.error('Error generating Streamlit code:', error);
              yield {
                  type: 'error',
                  content: 'Error generating Streamlit code',
              } as unknown as StreamChunk;
            }
          }
        }
        currentContentBlock = null;
      } else if (event.type === 'message_delta') {
        Object.assign(currentMessage, event.delta);
      } else if (event.type === 'message_stop') {
        this.messages.push(this.convertStreamMessageToMessage(currentMessage));
        currentMessage = null;
      }
    }
  }
private convertStreamMessageToMessage(streamMessage: any): Message {
  return {
    role: streamMessage.role,
    content: streamMessage.content.find((block: any) => block.type === 'text')?.text || '',
    tool_calls: streamMessage.content
      .filter((block: any) => block.type === 'tool_use')
      .map((block: any) => ({
        id: block.id,
        name: block.name,
        parameters: block.input,
      })),
    created_at: new Date(),
  };
}

  async *sendToolResults(
    toolResults: ToolResult[],
    tools: Tool[],
    temperature: number,
    maxTokens: number
  ): AsyncGenerator<StreamChunk> {
    const messages = this.buildChatHistory();
    
    const toolResultMessage: Message = {
      role: 'user',
      content: JSON.stringify(toolResults),
      tool_results: toolResults,
      created_at: new Date(),
    };

    messages.push(toolResultMessage);
    this.messages.push(toolResultMessage);

    const stream = await this.client.messages.stream({
      model: this.model,
      system: this.roleDescription,
      messages,
      temperature,
      max_tokens: maxTokens,
      tools,
    });

    for await (const event of stream) {
      yield event as StreamChunk;
    }
  }

  private buildChatHistory(): any[] {
    return this.messages.map(message => ({
      role: message.role,
      content: message.content,
      ...(message.tool_calls && { tool_calls: message.tool_calls }),
      ...(message.tool_results && { tool_results: message.tool_results }),
    }));
  }

  clearMemory(): void {
    this.messages = [];
  }

  get history(): Message[] {
    return this.messages;
  }
}
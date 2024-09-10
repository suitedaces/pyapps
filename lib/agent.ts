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
    const messages = this.buildChatHistory();
    const userMessage: Message = { 
      role: 'user', 
      content: latestMessage, 
      created_at: new Date() 
    };
    messages.push(userMessage);
    this.messages.push(userMessage);

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

        this.messages.push({
          role: 'assistant',
          content: fullResponse.trim(),
          created_at: new Date(),
          tool_results: generatedCode ? [{
            id: currentMessage.id,
            name: 'create_streamlit_app',
            result: generatedCode,
          }] : undefined,
        });

        currentMessage = null;
        accumulatedResponse = '';
        generatedCode = '';
      }
    }
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


  private async *streamExplanation(
    generatedCode: string,
    tools: Tool[],
    temperature: number,
    maxTokens: number
  ): AsyncGenerator<StreamChunk> {
    const explanationQuery = `Explain the following Streamlit code in simple terms:

${generatedCode}

Provide a brief overview of what the code does and how it utilizes the CSV data.`;

    const stream = await this.client.messages.stream({
      model: this.model,
      messages: [{ role: 'user', content: explanationQuery }],
      temperature,
      max_tokens: maxTokens,
    });

    let explanationText = '\n\nHere\'s an explanation of the generated Streamlit code:\n\n';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        explanationText += event.delta.text;
        yield {
          type: 'code_explanation',
          content: event.delta.text,
        } as unknown as StreamChunk;
      }
    }

    if (this.messages.length > 0) {
      const lastMessage = this.messages[this.messages.length - 1];
      if (lastMessage.role === 'assistant') {
        lastMessage.content += explanationText;
      }
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
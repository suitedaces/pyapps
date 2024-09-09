import { Anthropic } from '@anthropic-ai/sdk'
import { Message, ToolResult, StreamChunk, CSVAnalysis } from './types'
import { generateCode } from './tools'
import { Tool } from './types'
import prisma from './prisma'

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

  async *chat(
    chatId: string,
    latestMessage: string,
    tools: Tool[],
    temperature: number,
    maxTokens: number,
    csvAnalysis?: CSVAnalysis
  ): AsyncGenerator<StreamChunk> {
    const messages = await this.buildChatHistory(chatId)
    console.log('Chat history before the stream:', messages)
    const userMessage: Message = { 
      role: 'user', 
      content: latestMessage, 
      createdAt: new Date(),
      chatId 
    }
    messages.push(userMessage)
    await prisma.message.create({ data: userMessage })

    const sanitizedMessages = this.ensureAlternatingMessages(messages)

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
  
    for await (const event of stream) {
      console.log('Received stream chunk:', event)
      yield event as StreamChunk
  
      if (event.type === 'message_start') {
        currentMessage = event.message
      } else if (event.type === 'content_block_start') {
        currentContentBlock = event.content_block
        accumulatedJson = ''
      } else if (event.type === 'content_block_delta') {
        if (currentContentBlock.type === 'text' && event.delta.type === 'text_delta') {
          currentContentBlock.text = (currentContentBlock.text || '') + event.delta.text
          accumulatedResponse += event.delta.text
        } else if (currentContentBlock.type === 'tool_use' && event.delta.type === 'input_json_delta') {
          accumulatedJson += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (currentContentBlock.type === 'tool_use') {
          currentContentBlock.input = accumulatedJson
          currentMessage.content.push(currentContentBlock)
          if (currentContentBlock.name === 'create_streamlit_app') {
            console.log('Generating Streamlit code for:', currentContentBlock)
            try {
              const toolInput = JSON.parse(accumulatedJson)
              const codeQuery = `
                Create a Streamlit app that ${toolInput.query}
                Use the following CSV analysis to inform your code:
                ${JSON.stringify(csvAnalysis, null, 2)}
              `
              generatedCode = await generateCode(codeQuery)
              
              yield {
                type: 'generated_code',
                content: generatedCode,
              } as StreamChunk
            } catch (error) {
              console.error('Error parsing JSON or generating Streamlit code:', error)
              yield {
                type: 'error',
                content: 'Error in code generation process',
              } as StreamChunk
            }
          }
        }
        currentContentBlock = null
      } else if (event.type === 'message_delta') {
        Object.assign(currentMessage, event.delta)
      } else if (event.type === 'message_stop') {
        let fullResponse = accumulatedResponse

        if (generatedCode) {
          fullResponse += `\n\nI've generated the following Streamlit code based on your request:\n\n\`\`\`python\n${generatedCode}\n\`\`\``
        }

        await prisma.message.create({
          data: {
            chatId,
            role: 'assistant',
            content: fullResponse.trim(),
            toolCalls: generatedCode ? [{
              id: currentMessage.id,
              name: 'create_streamlit_app',
              result: generatedCode,
            }] : undefined,
          },
        })

        currentMessage = null
        accumulatedResponse = ''
        generatedCode = ''
      }
    }
  }

  private async buildChatHistory(chatId: string): Promise<any[]> {
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    })
    return messages.map(message => ({
      role: message.role,
      content: message.content,
      ...(message.toolCalls && { tool_calls: message.toolCalls }),
      ...(message.toolResults && { tool_results: message.toolResults }),
    }))
  }

  private ensureAlternatingMessages(messages: any[]): any[] {
    if (messages.length === 0) return []

    const result: any[] = []
    let lastRole: 'user' | 'assistant' | null = null

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      
      if (message.role === 'user') {
        if (lastRole === 'user') {
          // Combine consecutive user messages
          result[result.length - 1].content += '\n\n' + message.content
        } else {
          result.push(message)
        }
        lastRole = 'user'
      } else if (message.role === 'assistant' && lastRole === 'user') {
        result.push(message)
        lastRole = 'assistant'
      }
    }

    // Ensure the last message is from the user
    if (result.length > 0 && result[result.length - 1].role === 'assistant') {
      result.pop()
    }

    return result
  }
}
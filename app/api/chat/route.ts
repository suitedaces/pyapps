import { NextRequest } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a data analyst and Python developer specializing in Streamlit app development. 
Your job is to analyze CSV data and generate Python code for visualization and analysis using Streamlit. 
Ensure the generated code is a complete, runnable Streamlit application.`.replace('\n', ' ');

const tools = [
  {
    name: "generate_code",
    description: "Generates Python (Streamlit) code based on a given query",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Explain the requirements for the Streamlit code you want to generate",
        },
      },
      required: ["query"],
    },
  },
];

async function generateCode(query: string): Promise<string> {
  if (!query || !query.trim()) {
    throw new Error('Query cannot be empty or just whitespace.');
  }

  console.log('Sending query to LLM:', query);

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2000,
      system: "You are a Python code generation assistant specializing in Streamlit apps. Generate a complete, runnable Streamlit app based on the given query. Only respond with the code, no explanations.",
      messages: [{ role: "user", content: query }],
    });

    if (Array.isArray(response.content) && response.content.length > 0) {
      return response.content[0].type === 'text' ? response.content[0].text : '';
    } else {
      console.error('Unexpected response format:', response);
      throw new Error('Unexpected response format from code generation API');
    }
  } catch (error) {
    console.error('Error generating code:', error);
    throw new Error('Failed to generate code. Please check the query and try again.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages, csvContent, csvFileName } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Invalid or empty messages array');
    }

    const validatedMessages = messages.filter(msg => msg.role && msg.content && msg.content.trim() !== '');

    if (validatedMessages.length === 0) {
      throw new Error('No valid messages found');
    }

    const stream = await anthropic.messages.stream({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: validatedMessages,
      tool_choice: { type: 'auto' },
      tools: tools,
    });

    let fullResponse = '';
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let partialJsonInput = '';
    
        try {
          for await (const chunk of stream) {
            console.log('Received chunk:', chunk);
    
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
              partialJsonInput += chunk.delta.partial_json;
            }
    
            if (chunk.type === 'content_block_stop' && partialJsonInput) {
              try {
                const parsedInput = JSON.parse(partialJsonInput);
                if (parsedInput.query) {
                  console.log('Generating code for query:', parsedInput.query);
                  const generatedCode = await generateCode(parsedInput.query);
                  controller.enqueue(encoder.encode(JSON.stringify({
                    type: 'generated_code',
                    content: generatedCode
                  }) + '\n'));
                } else {
                  console.error('No query provided for code generation');
                  controller.enqueue(encoder.encode(JSON.stringify({
                    type: 'error',
                    content: 'No query provided for code generation'
                  }) + '\n'));
                }
              } catch (error) {
                console.error('Error parsing JSON input:', error);
                controller.enqueue(encoder.encode(JSON.stringify({
                  type: 'error',
                  content: 'Error parsing input JSON'
                }) + '\n'));
              }
              partialJsonInput = '';
            } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              fullResponse += chunk.delta.text;
              controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
            }
          }
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'full_response', content: fullResponse }) + '\n'));
          controller.close();
        } catch (error) {
          console.error('Error in stream processing:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(JSON.stringify({ error: 'An error occurred', details: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const runtime = 'edge';
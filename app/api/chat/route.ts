import { NextRequest } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a data analyst specialized in CSV analysis and Streamlit app creation. When provided with CSV data, analyze it and generate appropriate Streamlit code for visualization and analysis. Use the execute_python tool to run Python code in a Jupyter notebook cell.`;

const tools: Anthropic.Messages.Tool[] = [
  {
    name: 'execute_python',
    description: 'Execute python code in a Jupyter notebook cell and returns any result, stdout, stderr, display_data, and error.',
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The python code to execute in a single cell.'
        }
      },
      required: ['code']
    }
  }
];

export async function POST(request: NextRequest) {
  const { messages, csvContent, csvFileName } = await request.json();

  try {
    const stream = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: messages,
      tools: tools,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') {
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
          }
        }
        controller.close();
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
    console.error('Error in chat:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const runtime = 'edge';
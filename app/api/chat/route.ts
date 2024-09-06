import { NextRequest } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { GruntyAgent } from '@/lib/agent';
import { tools } from '@/lib/tools';
import { analyzeCSV } from '@/lib/csvAnalyzer';
import { CSVAnalysis, StreamChunk } from '@/lib/types';
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  }
});

const agent = new GruntyAgent(
  anthropic,
  "claude-3-5-sonnet-20240620",
  "AI Assistant",
  CHAT_SYSTEM_PROMPT
);

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { messages, csvContent, csvFileName } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Invalid or empty messages array');
    }

    let csvAnalysis: CSVAnalysis | undefined;
    if (csvContent) {
      csvAnalysis = await analyzeCSV(csvContent);
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chatGenerator = agent.chat(
            messages[messages.length - 1].content,
            tools,
            0.7,
            4000,
            csvAnalysis
          );

          for await (const chunk of chatGenerator) {
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
          }

          controller.close();
        } catch (error) {
          console.error('Error in stream processing:', error);
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'error',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          } as unknown as StreamChunk) + '\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(
      encoder.encode(JSON.stringify({
        type: 'error',
        content: 'An error occurred while processing your request',
        details: error instanceof Error ? error.message : 'Unknown error'
      } as unknown as StreamChunk) + '\n'),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const runtime = 'edge';
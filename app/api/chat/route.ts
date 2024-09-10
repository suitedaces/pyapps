import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Anthropic } from '@anthropic-ai/sdk';
import { GruntyAgent } from '@/lib/agent';
import { tools } from '@/lib/tools';
import { analyzeCSV } from '@/lib/csvAnalyzer';
import { CSVAnalysis, StreamChunk } from '@/lib/types';
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts';
import { createChat, addMessage } from '@/lib/supabase';
import { NextRequest } from 'next/server';

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
  console.log('POST request received at /api/chat');
  const encoder = new TextEncoder();

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.log('User not authenticated');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { messages, csvContent, csvFileName } = await request.json();
    console.log('Request payload:', { messagesCount: messages?.length, hasCsvContent: !!csvContent, csvFileName });

    if (!Array.isArray(messages) || messages.length === 0) {
      console.log('Invalid or empty messages array');
      throw new Error('Invalid or empty messages array');
    }

    const userId = session.user.id;
    console.log('User ID:', userId);

    let csvAnalysis: CSVAnalysis | undefined;
    if (csvContent) {
      console.log('Analyzing CSV content');
      csvAnalysis = await analyzeCSV(csvContent);
      console.log('CSV analysis completed');
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Creating new chat');
          const chat = await createChat(userId, "New Chat");
          console.log('Chat created with ID:', chat.id);

          console.log('Starting chat generator');
          const chatGenerator = agent.chat(
            messages[messages.length - 1].content,
            tools,
            0.7,
            4000,
            csvAnalysis
          );

          console.log('Processing chat generator chunks');
          for await (const chunk of chatGenerator) {
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
            
            if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
              await addMessage(chat.id, userId, chunk.delta.text, 'assistant');
            }
          }

          console.log('Chat generation completed');
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

    console.log('Returning stream response');
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

import { NextRequest } from 'next/server';
import { Anthropic, APIError } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an AI assistant specializing in data analysis and Streamlit app development. Your role is to assist users with data queries, analysis, and visualization. Follow these guidelines:
1. Use Markdown formatting for structure (headers, lists, code blocks).
2. For code, use triple backticks with language identifiers (e.g., \`\`\`python).
3. Provide clear explanations with code suggestions.
4. Use the generate_code function for Streamlit app creation or updates.
5. Ask for clarification on data details when needed.
6. Offer multiple approaches for complex analyses when appropriate.
Analyze queries carefully and suggest helpful visualizations or analyses.`;

const tools = [
  {
    name: "create_streamlit_app",
    description: "Generates Python (Streamlit) code based on a given query",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Explain the requirements for the Streamlit code you want to generate. Include details about the data if there's any context and the column names VERBATIM as a list, with any spaces or special chars like this: [\"col 1 \", \" 2col 1\"].",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "run_python_notebook_analysis",
    description: "Runs analysis on a Python notebook",
    input_schema: {
      type: "object" as const,
      properties: {
        python_code: {
          type: "string",
          description: "Provide only the exact Python code to analyze in the Jupyter notebook"
        }
      },
      required: ["python_code"],
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
      system: "You are a Python code generation assistant specializing in Streamlit apps. These are the packages installed where your code will run: [streamlit, pandas, numpy, matplotlib, requests, seaborn, plotly]. Generate a complete, runnable Streamlit app based on the given query. DO NOT use \"st.experimental_rerun()\" at any cost. Only respond with the code, no explanations!",
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
  const encoder = new TextEncoder();

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
          if (error instanceof APIError) {
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'error',
              content: `API Error: ${error.message}`,
              status: error.status,
              error: error.error
            }) + '\n'));
          } else {
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'error',
              content: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }) + '\n'));
          }
          controller.close();
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
    return new Response(
      encoder.encode(JSON.stringify({
        type: 'error',
        content: 'An error occurred while processing your request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }) + '\n'),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const runtime = 'edge';
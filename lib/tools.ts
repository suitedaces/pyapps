import { Anthropic } from '@anthropic-ai/sdk';
import { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import { CSVAnalysis } from './types';

const codeGenerationAnthropicAgent = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const tools: Tool[] = [
  {
    name: "generate_code",
    description: "Generate Python code based on a given query",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Query describing the code to be generated",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "analyze_csv",
    description: "Analyze the uploaded CSV file",
    input_schema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Specific analysis operation to perform",
        },
      },
      required: ["operation"],
    },
  },
];

export const functions: { [key: string]: Function } = {
  generate_code: async (input: { query: string; csvAnalysis: CSVAnalysis }): Promise<string> => {
    try {
      const response = await codeGenerationAnthropicAgent.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4000,
        system: "You are a code generation assistant. Your task is to write Python code based on the given query and CSV analysis. The code should work with the provided CSV data structure. Respond with only the Python code, no explanations or comments.",
        messages: [
          { role: "assistant", content: `CSV Analysis: ${JSON.stringify(input.csvAnalysis, null, 2)}` },
          { role: "user", content: input.query }
        ],
      });

      const generatedCode = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return generatedCode;
    } catch (err) {
      console.error(`Error generating code:`, err);
      return `Error generating code for query: ${input.query}`;
    }
  },
  analyze_csv: async (input: { operation: string; csvContent: string; csvAnalysis: CSVAnalysis }): Promise<string> => {
    try {
      // Perform additional analysis based on the operation
      // For now, we'll just return the existing analysis
      return JSON.stringify(input.csvAnalysis, null, 2);
    } catch (err) {
      console.error(`Error analyzing CSV:`, err);
      return `Error analyzing CSV for operation: ${input.operation}`;
    }
  },
};

export function toolExists(name: string): boolean {
  return tools.some(tool => tool.name === name);
}

export function getToolByName(name: string): Tool | undefined {
  return tools.find(tool => tool.name === name);
}
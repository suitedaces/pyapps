import { Anthropic } from '@anthropic-ai/sdk';
import { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";

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
];

export const functions = {
  generate_code: async (input: { query: string }): Promise<string> => {
    try {
      const response = await codeGenerationAnthropicAgent.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4000,
        system: "You are a code generation assistant. Your task is to write Python code based on the given query. Respond with only the Python code, no explanations or comments.",
        messages: [{ role: "user", content: input.query }],
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
};

// Helper function to check if a tool exists
export function toolExists(name: string): boolean {
  return tools.some(tool => tool.name === name);
}

// Helper function to get a tool by name
export function getToolByName(name: string): Tool | undefined {
  return tools.find(tool => tool.name === name);
}
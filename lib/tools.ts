import { Anthropic } from "@anthropic-ai/sdk";
import { CSVAnalysis } from "./types";
import { Tool } from "./types";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const codeGenerationAnthropicAgent = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const tools: Tool[] = [
  {
    name: "create_streamlit_app",
    description: "Generates Python (Streamlit) code based on a given query",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            'Explain the requirements for the Streamlit code you want to generate. Include details about the data if there\'s any context and the column names VERBATIM as a list, with any spaces or special chars like this: ["col 1 ", " 2col 1"].',
        },
        appId: {
          type: "string",
          description: "The ID of the app to create a new version for",
        },
      },
      required: ["query", "appId"],
    },
  },
];

export async function generateCode(query: string): Promise<string> {
  if (!query || !query.trim()) {
    throw new Error("Query cannot be empty or just whitespace.");
  }

  console.log("Sending query to LLM:", query);

  try {
    const response = await codeGenerationAnthropicAgent.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2000,
      system:
        'You are a Python code generation assistant specializing in Streamlit apps. These are the packages installed where your code will run: [streamlit, pandas, numpy, matplotlib, requests, seaborn, plotly]. Generate a complete, runnable Streamlit app based on the given query. DO NOT use "st.experimental_rerun()" at any cost. Only respond with the code, no potential errors, no explanations!',
      messages: [{ role: "user", content: query }],
    });

    if (Array.isArray(response.content) && response.content.length > 0) {
      const generatedCode =
        response.content[0].type === "text"
          ? response.content[0].text
              .replace(/^```python/, "")
              .replace(/```$/, "")
          : "";
      return generatedCode;
    } else {
      console.error("Unexpected response format:", response);
      throw new Error("Unexpected response format from code generation API");
    }
  } catch (error) {
    console.error("Error generating code:", error);
    throw new Error(
      "Failed to generate code. Please check the query and try again.",
    );
  }
}

export const functions = {
  create_streamlit_app: async (input: {
    query: string;
    csvAnalysis: CSVAnalysis;
    appId: string;
  }): Promise<string> => {
    try {
      const generatedCode = await generateCode(input.query);

      // Create a new app version with the generated code
      const supabase = createRouteHandlerClient({ cookies });
      const { data, error } = await supabase
        .from("app_versions")
        .insert({
          app_id: input.appId,
          code: generatedCode,
          version_number: 1, // You might want to implement logic to increment this
          prompt: input.query,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create app version: ${error.message}`);
      }

      return generatedCode;
    } catch (err) {
      console.error(`Error generating Streamlit app:`, err);
      return `Error generating Streamlit app for query: ${input.query}`;
    }
  },
};

export function toolExists(name: string): boolean {
  return tools.some((tool) => tool.name === name);
}

export function getToolByName(name: string): any {
  return tools.find((tool) => tool.name === name);
}

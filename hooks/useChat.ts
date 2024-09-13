import { useState, useCallback, useEffect } from "react";
import { Message, StreamChunk } from "@/lib/types";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Session } from "@supabase/supabase-js";

interface SandboxError {
  message: string;
  traceback?: string;
}

export function useChat(chatId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientComponentClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeExplanation, setCodeExplanation] = useState("");
  const [sandboxErrors, setSandboxErrors] = useState<SandboxError[]>([]);
  const [sandboxId, setSandboxId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    if (chatId) {
      fetchMessages();
      initializeSandbox();
    } else {
      // reset state when no chat is selected
      setMessages([]);
      setCsvContent(null);
      setCsvFileName(null);
      setStreamlitUrl(null);
      setGeneratedCode("");
      setStreamingMessage("");
      setCodeExplanation("");
      setSandboxErrors([]);
      setSandboxId(null);
    }
  }, [chatId]);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const response = await fetch(`/api/conversations/${chatId}/messages`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [chatId]);

  const initializeSandbox = useCallback(async () => {
    try {
      const response = await fetch("/api/sandbox/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSandboxId(data.sandboxId);
      console.log("Sandbox initialized with ID:", data.sandboxId);
    } catch (error) {
      console.error("Error initializing sandbox:", error);
      setSandboxErrors((prev) => [
        ...prev,
        {
          message: "Error initializing sandbox",
          traceback: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    [],
  );

  const updateStreamlitApp = useCallback(
    async (code: string) => {
      if (code && sandboxId) {
        try {
          console.log("Updating Streamlit app with code:", code);
          const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          if (data.url) {
            setStreamlitUrl(data.url);
            console.log("Streamlit URL updated:", data.url);
          } else {
            throw new Error("No URL returned from sandbox API");
          }
        } catch (error) {
          console.error("Error updating Streamlit app:", error);
          setSandboxErrors((prev) => [
            ...prev,
            {
              message: "Error updating Streamlit app",
              traceback: error instanceof Error ? error.message : String(error),
            },
          ]);
        } finally {
          setIsGeneratingCode(false);
        }
      } else {
        console.error(
          "Generated code not available or sandbox not initialized",
        );
      }
    },
    [sandboxId],
  );

  const processStreamChunk = useCallback(
    (chunk: string, accumulatedResponse: string, accumulatedCode: string) => {
      try {
        const parsedChunk: StreamChunk = JSON.parse(chunk);
        if (
          parsedChunk.type === "content_block_delta" &&
          "delta" in parsedChunk &&
          parsedChunk.delta?.type === "text_delta"
        ) {
          accumulatedResponse += parsedChunk.delta.text;
          setStreamingMessage((prev) => prev + parsedChunk.delta.text);
        } else if (
          parsedChunk.type === "generated_code" &&
          "content" in parsedChunk
        ) {
          accumulatedCode += parsedChunk.content;
          setGeneratedCode((prev) => prev + parsedChunk.content);
        } else if (
          parsedChunk.type === "code_explanation" &&
          "content" in parsedChunk
        ) {
          setCodeExplanation((prev) => prev + parsedChunk.content);
        } else if (parsedChunk.type === "message_stop") {
          setIsGeneratingCode(false);
        } else if (
          parsedChunk.type === "tool_use" &&
          parsedChunk.name === "create_streamlit_app"
        ) {
          setIsGeneratingCode(true);
        }
      } catch (error) {
        console.error("Error parsing chunk:", error);
      }
      return { accumulatedResponse, accumulatedCode };
    },
    [],
  );

  const processStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const decoder = new TextDecoder();
      let accumulatedResponse = "";
      let accumulatedCode = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          const result = processStreamChunk(
            line,
            accumulatedResponse,
            accumulatedCode,
          );
          accumulatedResponse = result.accumulatedResponse;
          accumulatedCode = result.accumulatedCode;
        }
      }

      return { accumulatedResponse, accumulatedCode };
    },
    [processStreamChunk],
  );

  const handleChatOperation = useCallback(
    async (newMessage: Message) => {
      if (isLoading || !session || !chatId) {
        console.error(
          "User not authenticated, session is loading, or no chat selected",
        );
        return;
      }

      setIsLoading(true);
      setStreamingMessage("");
      setGeneratedCode("");
      setCodeExplanation("");
      setSandboxErrors([]);

      try {
        const response = await fetch(`/api/conversations/${chatId}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: newMessage.content }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get response reader");
        }

        const { accumulatedResponse, accumulatedCode } =
          await processStream(reader);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: accumulatedResponse,
            created_at: new Date(),
          },
        ]);

        if (accumulatedCode) {
          setGeneratedCode(accumulatedCode);
          console.log("Generated code:", accumulatedCode);
          await updateStreamlitApp(accumulatedCode);
        }

        if (codeExplanation) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: codeExplanation,
              created_at: new Date(),
            },
          ]);
        }
      } catch (error) {
        console.error("Error in chat operation:", error);
        setMessages((prev) => [
          ...prev,
          newMessage,
          {
            role: "assistant",
            content: "An error occurred. Please try again.",
            created_at: new Date(),
          },
        ]);
        setSandboxErrors((prev) => [
          ...prev,
          {
            message: "Error in chat operation",
            traceback: error instanceof Error ? error.message : String(error),
          },
        ]);
      } finally {
        setIsLoading(false);
        setStreamingMessage("");
        setIsGeneratingCode(false);
      }
    },
    [
      session,
      isLoading,
      chatId,
      processStream,
      updateStreamlitApp,
      codeExplanation,
    ],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim()) return;

      const newUserMessage: Message = {
        role: "user",
        content: input,
        created_at: new Date(),
      };
      setMessages((prev) => [...prev, newUserMessage]);
      setInput("");

      await handleChatOperation(newUserMessage);
    },
    [input, handleChatOperation],
  );

  const handleFileUpload = useCallback(
    async (content: string, fileName: string) => {
      const sanitizeCSVContent = (content: string): string => {
        return content
          .split("\n")
          .map((row) => row.replace(/[\r\n]+/g, ""))
          .join("\n");
      };

      const sanitizedContent = sanitizeCSVContent(content);
      const lines = sanitizedContent
        .split("\n")
        .filter((line) => line.trim() !== "");

      const headers = lines[0].split(",").map((header) => header.trim());
      const dataRows = lines
        .slice(1)
        .map((line) => line.split(",").map((value) => value.trim()));

      const formatTableRow = (row: string[]): string =>
        `| ${row.map((cell) => cell.replace(/\|/g, "\\|").replace(/\n/g, "<br>")).join(" | ")} |`;

      const markdownTable = `
  | ${headers.join(" | ")} |
  | ${headers.map(() => "---").join(" | ")} |
  ${dataRows.slice(0, 5).map(formatTableRow).join("\n")}`;

      setCsvContent(content);
      setCsvFileName(fileName);

      try {
        const response = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name: fileName,
            file_type: "csv",
            file_size: content.length,
            file_url: "placeholder_url", // You might want to implement actual file storage
            content: content, // This is not ideal for large files, consider using FormData and file upload
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("CSV uploaded and stored:", data);

        // Analyze the CSV file
        const analysisResponse = await fetch(`/api/files/${data.id}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileContent: content }),
        });

        if (!analysisResponse.ok) {
          throw new Error(`HTTP error! status: ${analysisResponse.status}`);
        }

        const analysisData = await analysisResponse.json();
        console.log("CSV analyzed:", analysisData);

        const newUserMessage: Message = {
          role: "user",
          content: `I've uploaded a CSV file named "${fileName}". Here's a preview of the data:
        
\`\`\`markdown
${markdownTable}
\`\`\`

Can you analyze it and create a Streamlit app to visualize the data? Make sure to use the exact column names when reading the CSV in your code.`,
          created_at: new Date(),
        };

        setMessages((prev) => [...prev, newUserMessage]);

        await handleChatOperation(newUserMessage);
      } catch (error) {
        console.error("Error in file upload:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `There was an error uploading the file: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
            created_at: new Date(),
          },
        ]);
        setSandboxErrors((prev) => [
          ...prev,
          {
            message: "Error uploading file",
            traceback: error instanceof Error ? error.message : String(error),
          },
        ]);
      }
    },
    [handleChatOperation],
  );

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    handleFileUpload,
    csvContent,
    csvFileName,
    streamlitUrl,
    generatedCode,
    streamingMessage,
    isGeneratingCode,
    streamingCodeExplanation: codeExplanation,
    sandboxErrors,
    sandboxId,
  };
}

import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/lib/types'
import { CodeInterpreter } from '@e2b/code-interpreter'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeInterpreter, setCodeInterpreter] = useState<CodeInterpreter | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');

  useEffect(() => {
    async function createInterpreter() {
      try {
        const interpreter = await CodeInterpreter.create({ apiKey: "e2b_d05766c8269872cc3e43114a87eca0b66ebc784a"});
        setCodeInterpreter(interpreter);
      } catch (error) {
        console.error('Error creating CodeInterpreter:', error);
      }
    }
    createInterpreter();

    return () => {
      if (codeInterpreter) {
        codeInterpreter.close();
      }
    };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  const extractCodeFromResponse = (response: string) => {
    console.log("Extracting code from response:", response);
    const codeBlocks = response.match(/```python\n([\s\S]*?)```/g);
    console.log("Found code blocks:", codeBlocks);
    if (codeBlocks && codeBlocks.length > 0) {
      // Get the last code block
      const lastCodeBlock = codeBlocks[codeBlocks.length - 1];
      // Remove the backticks and 'python' from the code block
      const extractedCode = lastCodeBlock.replace(/```python\n|```/g, '').trim();
      console.log("Extracted code:", extractedCode);
      return extractedCode;
    }
    console.log("No code blocks found");
    return '';
  };


  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    const newUserMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setStreamingMessage('');
    setGeneratedCode('');

    try {
      // Prepare messages for API, ensuring alternation
      const apiMessages = messages.reduce((acc: Message[], message: Message, index: number) => {
        if (index === 0 || message.role !== acc[acc.length - 1].role) {
          acc.push(message);
        } else {
          acc[acc.length - 1].content += '\n' + message.content;
        }
        return acc;
      }, []);

      console.log("Sending messages to API:", apiMessages);

      // Add the new user message
      apiMessages.push(newUserMessage);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, csvContent, csvFileName }),
      });

      if (!response.ok) throw new Error('Failed to fetch from chat API');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsedChunk = JSON.parse(line);
            if (parsedChunk.type === 'content_block_delta') {
              accumulatedResponse += parsedChunk.delta.text;
              setStreamingMessage(prev => prev + parsedChunk.delta.text);
            } else if (parsedChunk.type === 'full_response') {
              const extractedCode = extractCodeFromResponse(parsedChunk.content);
              console.log("Setting generated code:", extractedCode);
              setGeneratedCode(extractedCode);
            }
          } catch (error) {
            console.error('Error parsing chunk:', error);
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accumulatedResponse }]);

      if (codeInterpreter && generatedCode) {
        const exec = await codeInterpreter.notebook.execCell(generatedCode);
        if (exec.error) {
          console.error('Error executing Streamlit code:', exec.error);
        } else {
          console.log('Streamlit code executed successfully');
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'An error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
      setStreamingMessage('');
    }
  }, [input, messages, csvContent, csvFileName, codeInterpreter]);
  const handleFileUpload = useCallback(async (content: string, fileName: string) => {
    setCsvContent(content);
    setCsvFileName(fileName);

    try {
      if (codeInterpreter) {
        // Ensure the directory exists
        await codeInterpreter.filesystem.makeDir('/app');

        // Write the file
        await codeInterpreter.filesystem.write('/app/data.csv', content);

        // Read and display the first few rows
        const dfHead = await codeInterpreter.notebook.execCell(`
import pandas as pd
df = pd.read_csv('/app/data.csv')
print(df.head().to_string())
        `);
        if (dfHead.error) {
          throw dfHead.error;
        }

        const newMessage = {
          role: 'user' as const,
          content: `I've uploaded a CSV file named "${fileName}". Here are the first 5 rows of the data:\n\n${dfHead.logs.stdout}`
        };
  
        setMessages(prev => [...prev, newMessage]);
  
        // Send the new message to the API
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: [...messages, newMessage],
            csvContent, 
            csvFileName 
          }),
        });
  
        if (!response.ok) {
          throw new Error('Failed to send CSV upload message to chat API');
        }
        // After sending the message to the API
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedResponse = '';

        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            try {
              const parsedChunk = JSON.parse(line);
              if (parsedChunk.type === 'content_block_delta') {
                accumulatedResponse += parsedChunk.delta.text;
                setMessages(prev => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage.role === 'assistant') {
                    return [...prev.slice(0, -1), { ...lastMessage, content: lastMessage.content + parsedChunk.delta.text }];
                  } else {
                    return [...prev, { role: 'assistant', content: parsedChunk.delta.text }];
                  }
                });
              } else if (parsedChunk.type === 'full_response') {
              }
            } catch (error) {
              console.error('Error parsing chunk:', error);
            }
          }
        }
      } else {
        throw new Error('CodeInterpreter not initialized');
      }
    } catch (error) {
      console.error('Error in file upload:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `There was an error uploading the file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
        }
      ]);
    }
  }, [codeInterpreter]);

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
    streamingMessage
  };
}
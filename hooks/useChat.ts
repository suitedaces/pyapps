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

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    const newUserMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

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
              setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage.role === 'assistant') {
                  return [...prev.slice(0, -1), { ...lastMessage, content: lastMessage.content + parsedChunk.delta.text }];
                } else {
                  return [...prev, { role: 'assistant', content: parsedChunk.delta.text }];
                }
              });
            }
          } catch (error) {
            console.error('Error parsing chunk:', error);
          }
        }
      }

      // Check for Streamlit code in the accumulated response
      if (accumulatedResponse.includes('Here\'s the Streamlit code')) {
        const codeStart = accumulatedResponse.indexOf('```python') + 10;
        const codeEnd = accumulatedResponse.lastIndexOf('```');
        const code = accumulatedResponse.slice(codeStart, codeEnd).trim();
        setGeneratedCode(code);
        if (codeInterpreter) {
          const exec = await codeInterpreter.notebook.execCell(code);
          if (exec.error) {
            console.error('Error executing Streamlit code:', exec.error);
          } else {
            console.log('Streamlit code executed successfully');
            // Note: We can't set the Streamlit URL here as we don't have a method to get it
          }
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'An error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
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
  };
}
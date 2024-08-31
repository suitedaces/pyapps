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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, newUserMessage], csvContent, csvFileName }),
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
        await codeInterpreter.filesystem.write('/app/data.csv', content);

        const dfHead = await codeInterpreter.notebook.execCell(`
import pandas as pd
df = pd.read_csv('/app/data.csv')
print(df.head().to_string())
        `);

        setMessages(prev => [
          ...prev,
          {
            role: 'user',
            content: `I've uploaded a CSV file named "${fileName}". Here are the first 5 rows of the data:\n\n${dfHead.logs.stdout}`
          }
        ]);
      } else {
        console.error('CodeInterpreter not initialized');
      }
    } catch (error) {
      console.error('Error in file upload:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `There was an error uploading the file. Please try again.`
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
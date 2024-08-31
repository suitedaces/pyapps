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
      let done = false;
      let accumulatedResponse = '';

      while (!done) {
        const { value, done: doneReading } = await reader!.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        accumulatedResponse += chunkValue;

        // Append the chunk to the last assistant message or create a new one
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage.role === 'assistant') {
            return [...prev.slice(0, -1), { ...lastMessage, content: lastMessage.content + chunkValue }];
          } else {
            return [...prev, { role: 'assistant', content: chunkValue }];
          }
        });
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
      if (!codeInterpreter) {
        const interpreter = await CodeInterpreter.create();
        setCodeInterpreter(interpreter);
      }
      const fileBlob = new Blob([content], { type: 'text/csv' });
      await codeInterpreter?.filesystem.write('/app/data.csv', content);

      const dfHead = await codeInterpreter?.notebook.execCell(`
import pandas as pd
df = pd.read_csv('/app/data.csv')
print(df.head().to_string())
      `);

      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: `I've uploaded a CSV file named "${fileName}". Here are the first 5 rows of the data:\n\n${dfHead?.logs.stdout || 'Error: Unable to read file content'}`
        }
      ]);
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

  useEffect(() => {
    return () => {
      if (codeInterpreter) {
        codeInterpreter.close();
      }
    };
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
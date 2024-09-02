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
  const [streamingCode, setStreamingCode] = useState('');

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

  const prepareMessages = (messages: Message[], newMessage: Message): Message[] => {
    const preparedMessages: Message[] = [];
    let lastRole: 'user' | 'assistant' | null = null;

    for (const message of [...messages, newMessage]) {
      if (message.content.trim()) {
        if (message.role !== lastRole) {
          preparedMessages.push(message);
          lastRole = message.role;
        } else {
          // If the role is the same as the last one, combine the messages
          preparedMessages[preparedMessages.length - 1].content += '\n' + message.content;
        }
      }
    }

    // Ensure the messages alternate correctly
    if (preparedMessages.length > 1 && preparedMessages[0].role === 'assistant') {
      preparedMessages.shift();
    }

    return preparedMessages;
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
      const preparedMessages = prepareMessages(messages, newUserMessage);
      console.log("Sending messages to API:", JSON.stringify(preparedMessages, null, 2));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: preparedMessages, csvContent, csvFileName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let accumulatedResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsedChunk = JSON.parse(line);
            if (parsedChunk.type === 'content_block_delta' && parsedChunk.delta.type === 'text_delta') {
              accumulatedResponse += parsedChunk.delta.text;
              setStreamingMessage(prev => prev + parsedChunk.delta.text);
            } else if (parsedChunk.type === 'generated_code') {
              setGeneratedCode(parsedChunk.content);
            }
          } catch (error) {
            console.error('Error parsing chunk:', error);
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accumulatedResponse }]);

      if (codeInterpreter && generatedCode) {
        const exec = await codeInterpreter.(generatedCode);
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
        await codeInterpreter.filesystem.makeDir('/app');
        await codeInterpreter.filesystem.write('/app/data.csv', content);

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
  
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: prepareMessages(messages, newMessage),
            csvContent, 
            csvFileName 
          }),
        });
  
        if (!response.ok) {
          throw new Error('Failed to send CSV upload message to chat API');
        }

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
              if (parsedChunk.type === 'content_block_delta' && parsedChunk.delta.type === 'text_delta') {
                accumulatedResponse += parsedChunk.delta.text;
                setStreamingMessage(prev => prev + parsedChunk.delta.text);
              } else if (parsedChunk.type === 'generated_code') {
                setGeneratedCode(parsedChunk.content);
                setStreamingCode(parsedChunk.content); // Add this line
              }
            } catch (error) {
              console.error('Error parsing chunk:', error);
            }
          }
        }
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
  }, [codeInterpreter, messages]);

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
    streamingCode
  };
}
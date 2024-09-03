import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/lib/types';
import { Sandbox } from 'e2b';

type StreamChunk = {
  type: 'content_block_delta' | 'generated_code' | 'full_response';
  delta?: { type: 'text_delta'; text: string };
  content?: string;
};

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [streamlitUrl, setStreamlitUrl] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeInterpreter, setCodeInterpreter] = useState<Sandbox | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');

  useEffect(() => {
    async function createInterpreter() {
      try {
        const interpreter = await Sandbox.create({
          apiKey: "e2b_d05766c8269872cc3e43114a87eca0b66ebc784a",
          template: "streamlit-sandbox-me"
        });
        await interpreter.filesystem.makeDir('/app');
        setCodeInterpreter(interpreter);
      } catch (error) {
        console.error('Error creating CodeInterpreter:', error);
      }
    }
    createInterpreter();
  
    return () => {
      if (codeInterpreter) {
        codeInterpreter.close().catch(error => {
          console.error('Error closing CodeInterpreter:', error);
        });
      }
    };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  const prepareMessages = useCallback((messages: Message[], newMessage: Message): Message[] => {
    const preparedMessages: Message[] = [];
    let lastRole: 'user' | 'assistant' | null = null;

    for (const message of [...messages, newMessage]) {
      if (message.content.trim()) {
        if (message.role !== lastRole) {
          preparedMessages.push(message);
          lastRole = message.role;
        } else {
          preparedMessages[preparedMessages.length - 1].content += '\n' + message.content;
        }
      }
    }

    if (preparedMessages.length > 1 && preparedMessages[0].role === 'assistant') {
      preparedMessages.shift();
    }

    return preparedMessages;
  }, []);

  const processStreamChunk = useCallback((chunk: string, accumulatedResponse: string, accumulatedCode: string) => {
    try {
      const parsedChunk: StreamChunk = JSON.parse(chunk);
      if (parsedChunk.type === 'content_block_delta' && parsedChunk.delta?.type === 'text_delta') {
        accumulatedResponse += parsedChunk.delta.text;
        setStreamingMessage(prev => prev + parsedChunk.delta?.text);
      } else if (parsedChunk.type === 'generated_code' && parsedChunk.content) {
        accumulatedCode += parsedChunk.content;
        setGeneratedCode(prev => prev + parsedChunk.content);
      }
    } catch (error) {
      console.error('Error parsing chunk:', error);
    }
    return { accumulatedResponse, accumulatedCode };
  }, []);

  const processStream = useCallback(async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    let accumulatedResponse = '';
    let accumulatedCode = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        const result = processStreamChunk(line, accumulatedResponse, accumulatedCode);
        accumulatedResponse = result.accumulatedResponse;
        accumulatedCode = result.accumulatedCode;
      }
    }

    return { accumulatedResponse, accumulatedCode };
  }, [processStreamChunk]);

  const updateStreamlitApp = useCallback(async (code: string) => {
    if (codeInterpreter && code) {
      try {
        await codeInterpreter.filesystem.write('/app/app.py', code);
        console.log('Streamlit code updated');
  
        const process = await codeInterpreter.process.start({
          cmd: "streamlit run /app/app.py",
          onStdout: console.log,
          onStderr: console.error,
        });
        console.log('Streamlit process restarted');
  
        const url = codeInterpreter.getHostname(8501);
        console.log('Streamlit URL:', url);
        setStreamlitUrl('https://' + url);
      } catch (error) {
        console.error('Error updating Streamlit app:', error);
      }
    } else {
      console.error(`CodeInterpreter or generated code not available {codeInterpreter: ${!!codeInterpreter}, code length: ${code.length}}`);
    }
  }, [codeInterpreter]);

  const handleChatOperation = useCallback(async (newMessage: Message, apiEndpoint: string) => {
    setIsLoading(true);
    setStreamingMessage('');
  
    try {
      const preparedMessages = prepareMessages(messages, newMessage);
      console.log("Sending messages to API:", JSON.stringify(preparedMessages, null, 2));
  
      const response = await fetch(apiEndpoint, {
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
  
      const { accumulatedResponse, accumulatedCode } = await processStream(reader);
  
      // Check if the last message is already the user message we're processing
      setMessages(prev => {
        if (prev[prev.length - 1].content !== newMessage.content) {
          return [...prev, newMessage, { role: 'assistant', content: accumulatedResponse }];
        } else {
          return [...prev, { role: 'assistant', content: accumulatedResponse }];
        }
      });
      setGeneratedCode(accumulatedCode);
  
      if (accumulatedCode && codeInterpreter) {
        await updateStreamlitApp(accumulatedCode);
      }
    } catch (error) {
      console.error('Error in chat operation:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'An error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
      setStreamingMessage('');
    }
  }, [messages, csvContent, csvFileName, codeInterpreter, prepareMessages, processStream, updateStreamlitApp]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
  
    const newUserMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
  
    await handleChatOperation(newUserMessage, '/api/chat');
  }, [input, handleChatOperation]);

  const handleFileUpload = useCallback(async (content: string, fileName: string) => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    const headers = lines[0].split(',').map(header => `"${header}"`);
    console.log('Column names:', headers);
  
    const dataRows = lines.slice(1).map(line => line.split(','));
    console.log('First 5 data rows:', dataRows.slice(0, 5));
  
    setCsvContent(content);
    setCsvFileName(fileName);
  
    try {
      if (codeInterpreter) {
        const uploadedPath = await codeInterpreter.filesystem.write(`/app/${fileName}`, content);
        console.log('File uploaded to:', uploadedPath);
  
        const newMessage: Message = {
          role: 'user',
          content: `I've uploaded a CSV file named "/app/${fileName}" (use it exactly like that). Here's the structure:
  
  Column names (enclosed in quotes to show spaces):
  ${headers.join(', ')}
  
  First 5 data rows:
  ${dataRows.slice(0, 5).map(row => row.join(', ')).join('\n')}
  
  Can you analyze it and create a Streamlit app to visualize the data? When reading the CSV in your code, make sure to use the exact column names as they appear in the file.`
        };
  
        // Add the user message to the state immediately
        setMessages(prev => [...prev, newMessage]);
  
        // Then proceed with the chat operation
        await handleChatOperation(newMessage, '/api/chat');
      } else {
        throw new Error('CodeInterpreter not available for file upload');
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
  }, [codeInterpreter, handleChatOperation]);

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
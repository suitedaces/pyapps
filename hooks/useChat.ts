import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/lib/types'
import { Sandbox } from 'e2b'

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
  const [streamingCode, setStreamingCode] = useState('');

  useEffect(() => {
    async function createInterpreter() {
      try {
        const interpreter = await Sandbox.create({
          apiKey: "e2b_d05766c8269872cc3e43114a87eca0b66ebc784a",
          template: "streamlit-sandbox-me"
        });
        interpreter.filesystem.makeDir('/app');
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
          preparedMessages[preparedMessages.length - 1].content += '\n' + message.content;
        }
      }
    }

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
      let accumulatedCode = '';
  
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
              accumulatedCode += parsedChunk.content;
              setStreamingCode(prev => prev + parsedChunk.content);
            }
          } catch (error) {
            console.error('Error parsing chunk:', error);
          }
        }
      }
  
      setMessages(prev => [...prev, { role: 'assistant', content: accumulatedResponse }]);
      setGeneratedCode(accumulatedCode);
  
      console.log('Generated Code:', accumulatedCode);
  
      if (codeInterpreter && accumulatedCode) {
        try {
          await codeInterpreter.filesystem.write('/app/app.py', accumulatedCode);
          console.log('Streamlit code written to file');
  
          const process = await codeInterpreter.process.start({
            cmd: "streamlit run /app/app.py",
            onStdout: console.log,
            onStderr: console.error,
          });
          console.log('Streamlit process started');
  
          const url = codeInterpreter.getHostname(8501);
          console.log('Streamlit URL:', url);
          setStreamlitUrl('https://' + (url));
        } catch (error) {
          console.error('Error running Streamlit app:', error);
        }
      } else {
        console.error(`CodeInterpreter or generated code not available {codeInterpreter: ${!!codeInterpreter}, generatedCode length: ${accumulatedCode.length}}`);
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
      const uploadedPath = await codeInterpreter.filesystem.write(`/app/${fileName}`, content);
      console.log('File uploaded to:', uploadedPath);

      console.log(`CSV file uploaded successfully to /app/${fileName}`)

      const newMessage = {
        role: 'user' as const,
        content: `I've uploaded a CSV file named "/app/${fileName}". Can you analyze it and create a Streamlit app to visualize the data?`
      };

      setMessages(prev => [...prev, newMessage]);

      // Trigger the chat process to generate Streamlit code
      await handleSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>);
    } else {
      console.error('CodeInterpreter not available for file upload');
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
}, [codeInterpreter, handleSubmit]);
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
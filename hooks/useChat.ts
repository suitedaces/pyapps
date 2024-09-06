import { useState, useCallback, useEffect } from 'react';
import { Message, StreamChunk } from '@/lib/types';
import { Sandbox } from 'e2b';

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
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

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

  const processStreamChunk = useCallback((chunk: string, accumulatedResponse: string, accumulatedCode: string) => {
    try {
      const parsedChunk: StreamChunk = JSON.parse(chunk);
      if (parsedChunk.type === 'content_block_delta' && 'delta' in parsedChunk && parsedChunk.delta?.type === 'text_delta') {
        accumulatedResponse += parsedChunk.delta.text;
        setStreamingMessage(prev => prev + parsedChunk.delta.text);
      } else if (parsedChunk.type === 'generated_code' && 'content' in parsedChunk) {
        accumulatedCode += parsedChunk.content;
        setGeneratedCode(prev => prev + parsedChunk.content);
      } else if (parsedChunk.type === 'code_explanation' && 'content' in parsedChunk) {
        // For code explanations, we'll add them to the accumulated response
        accumulatedResponse += parsedChunk.content;
        setStreamingMessage(prev => prev + '\n\n' + parsedChunk.content);
      } else if (parsedChunk.type === 'message_stop') {
        setIsGeneratingCode(false);
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

  const handleChatOperation = useCallback(async (newMessage: Message, apiEndpoint: string) => {
    setIsLoading(true);
    setStreamingMessage('');
    setGeneratedCode('');
  
    try {
      console.log("Sending messages to API:", JSON.stringify([newMessage], null, 2));
  
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [newMessage], csvContent, csvFileName }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }
  
      const { accumulatedResponse, accumulatedCode } = await processStream(reader);
  
      setMessages(prev => {
        const updatedMessages = [...prev];
        
        if (accumulatedResponse) {
          updatedMessages.push({ 
            role: 'assistant', 
            content: accumulatedResponse, 
            created_at: new Date() 
          });
        }
        
        return updatedMessages;
      });
  
      if (accumulatedCode && codeInterpreter) {
        await updateStreamlitApp(accumulatedCode);
      }
    } catch (error) {
      console.error('Error in chat operation:', error);
      setMessages(prev => [...prev, newMessage, { 
        role: 'assistant', 
        content: 'An error occurred. Please try again.', 
        created_at: new Date() 
      }]);
    } finally {
      setIsLoading(false);
      setStreamingMessage('');
      setIsGeneratingCode(false);
    }
  }, [messages, csvContent, csvFileName, codeInterpreter, processStream, updateStreamlitApp]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
  
    const newUserMessage: Message = { 
      role: 'user', 
      content: input, 
      created_at: new Date() 
    };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
  
    await handleChatOperation(newUserMessage, '/api/chat');
  }, [input, handleChatOperation]);

  const handleFileUpload = useCallback(async (content: string, fileName: string) => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
  
    const headers = lines[0].split(',').map(header => header.trim());
    const dataRows = lines.slice(1).map(line => line.split(',').map(value => value.trim()));
  
    // Construct Markdown table
    const tableHeaders = `| ${headers.join(' | ')} |`;
    const tableDivider = `| ${headers.map(() => '---').join(' | ')} |`;
    const tableRows = dataRows.slice(0, 5).map(row => `| ${row.join(' | ')} |`).join('\n');
    const markdownTable = `\n${tableHeaders}\n${tableDivider}\n${tableRows}\n`;
  
    setCsvContent(content);
    setCsvFileName(fileName);
  
    try {
      if (codeInterpreter) {
        const uploadedPath = await codeInterpreter.filesystem.write(`/app/${fileName}`, content);
        console.log('File uploaded to:', uploadedPath);
  
        const newMessage: Message = {
          role: 'user',
          content: `I've uploaded a CSV file named "/app/${fileName}". Here's a preview of the data:
          
  \`\`\`markdown
  ${markdownTable}
  \`\`\`
  
  Can you analyze it and create a Streamlit app to visualize the data? Make sure to use the exact column names when reading the CSV in your code.`,
          created_at: new Date()
        };
  
        setMessages(prev => [...prev, newMessage]);
  
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
          content: `There was an error uploading the file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          created_at: new Date()
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
    streamingMessage,
    isGeneratingCode
  };
}
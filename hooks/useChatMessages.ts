import { useState, useCallback, useEffect } from 'react';
import { ClientMessage, Message, ToolCall, ToolResult } from '@/lib/types';

export function useChatMessages(id: string) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [lastFetchedMessageId, setLastFetchedMessageId] = useState<string | null>(null);

  const fetchNewMessages = useCallback(async () => {
    if (!id) return;

    try {
      const response = await fetch(`/api/conversations/${id}/messages`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const newMessages: Message[] = await response.json();

      if (newMessages.length > 0) {
        const clientMessages: ClientMessage[] = newMessages.flatMap((msg) => {
          const messages: ClientMessage[] = [
            {
              role: 'user',
              content: msg.user_message,
              created_at: new Date(msg.created_at),
            },
          ];

          if (msg.assistant_message) {
            messages.push({
              role: 'assistant',
              content: msg.assistant_message,
              created_at: new Date(msg.created_at),
              tool_calls: msg.tool_calls as ToolCall[] | null,
              tool_results: msg.tool_results as ToolResult[] | null,
            });
          }

          return messages;
        });

        setMessages((prevMessages) => {
          const allMessages = [...prevMessages, ...clientMessages];
          return allMessages.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
        });
        setLastFetchedMessageId(newMessages[newMessages.length - 1].id);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [id, lastFetchedMessageId]);

  useEffect(() => {
    if (id) {
      setMessages([]);
      setLastFetchedMessageId(null);
      fetchNewMessages();
    }
  }, [id, fetchNewMessages]);

  return { messages, fetchNewMessages };
}

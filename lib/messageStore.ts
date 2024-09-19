import { create } from 'zustand'

interface MessageState {
    loading: 'idle' | 'pending' | 'succeeded' | 'failed'
    error: string | null
    messageStoredChatId: string | null
    setMessageStop: () => void
    setMessageStored: (chatId: string) => void
    fetchTitle: (chatId: string) => Promise<void>
}

export const useMessageStore = create<MessageState>((set, get) => ({
    loading: 'idle',
    error: null,
    messageStoredChatId: null,

    setMessageStop: () => set({ loading: 'idle', error: null }),

    // Trigger state when a message is successfully stored
    setMessageStored: (chatId: string) => set({ messageStoredChatId: chatId }),

    fetchTitle: async (chatId: string) => {
        set({ loading: 'pending' })

        try {
            const response = await fetch(`/api/helper/${chatId}/title`)
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch messages (status: ${response.status})`
                )
            }
            const data = await response.json()

            // Log the fetched data to the console
            console.log('Fetched Messages of New Chat:', data)

            // No state update, just logging the result
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            set({ loading: 'idle' }) // Reset loading state after fetching
        }
    },
}))

// Subscribe to messageStoredChatId changes to trigger fetchTitle
useMessageStore.subscribe((state, prevState) => {
    if (state.messageStoredChatId && state.messageStoredChatId !== prevState.messageStoredChatId) {
        console.log('messageStoredChatId changed:', state.messageStoredChatId);
        // Call fetchTitle when the messageStoredChatId changes
        useMessageStore.getState().fetchTitle(state.messageStoredChatId);
    }
});

// Subscribe to the store's state changes (general logging for debugging)
useMessageStore.subscribe((newState) => {
    console.log('MessageStore state changed:', newState);
});

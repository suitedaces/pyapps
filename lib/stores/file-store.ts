import { create } from 'zustand'

interface FileData {
    id: string
    file_name: string
    file_type: string
    analysis: string | null
    created_at: string
}

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
    uploadedFileId: string | null
    currentFile: File | null
}

interface FileStore extends FileUploadState {
    chatFiles: Record<string, FileData[]> // Keyed by chatId
    
    // Upload actions
    setUploading: (isUploading: boolean) => void
    setProgress: (progress: number) => void 
    setError: (error: string | null) => void
    setUploadedFileId: (id: string | null) => void
    setCurrentFile: (file: File | null) => void
    reset: () => void
    uploadFile: (file: File) => Promise<string | null>

    // Chat file management
    setChatFiles: (chatId: string, files: FileData[]) => void
    loadChatFiles: (chatId: string) => Promise<void>
    linkFileToChat: (chatId: string, fileId: string) => Promise<void>
    unlinkFileFromChat: (chatId: string, fileId: string) => Promise<void>
}

export const useFileStore = create<FileStore>((set, get) => ({
    // Upload state
    isUploading: false,
    progress: 0,
    error: null,
    uploadedFileId: null,
    currentFile: null,
    chatFiles: {},

    // Upload actions
    setUploading: (isUploading) => set({ isUploading }),
    setProgress: (progress) => set({ progress }),
    setError: (error) => set({ error }),
    setUploadedFileId: (id) => set({ uploadedFileId: id }),
    setCurrentFile: (file) => set({ currentFile: file }),
    
    reset: () => set({
        isUploading: false,
        progress: 0,
        error: null,
        uploadedFileId: null,
        currentFile: null
    }),

    uploadFile: async (file: File) => {
        const store = get()
        store.setUploading(true)
        store.setError(null)
        store.setCurrentFile(file)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/files', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) throw new Error('Failed to upload file')

            const data = await response.json()
            if (!data.id) throw new Error('No file ID received')

            store.setUploadedFileId(data.id)
            return data.id

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
            store.setError(errorMessage)
            return null
        } finally {
            store.setUploading(false)
        }
    },

    // Chat file management
    setChatFiles: (chatId, files) => 
        set(state => ({
            chatFiles: {
                ...state.chatFiles,
                [chatId]: files
            }
        })),

    loadChatFiles: async (chatId) => {
        try {
            const response = await fetch(`/api/chats/files?chatId=${chatId}`)
            if (!response.ok) throw new Error('Failed to load chat files')
            const data = await response.json()
            get().setChatFiles(chatId, data.files || [])
        } catch (error) {
            console.error('Error loading chat files:', error)
            get().setError('Failed to load chat files')
        }
    },

    linkFileToChat: async (chatId, fileId) => {
        try {
            const response = await fetch('/api/chats/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, fileId })
            })
            if (!response.ok) throw new Error('Failed to link file to chat')
            await get().loadChatFiles(chatId) // Refresh chat files
        } catch (error) {
            console.error('Error linking file:', error)
            get().setError('Failed to link file to chat')
        }
    },

    unlinkFileFromChat: async (chatId, fileId) => {
        try {
            const response = await fetch(`/api/chats/files?chatId=${chatId}&fileId=${fileId}`, {
                method: 'DELETE'
            })
            if (!response.ok) throw new Error('Failed to unlink file')
            await get().loadChatFiles(chatId) // Refresh chat files
        } catch (error) {
            console.error('Error unlinking file:', error)
            get().setError('Failed to unlink file from chat')
        }
    }
})) 
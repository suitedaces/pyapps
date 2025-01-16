'use client'

import { Suspense } from 'react'
import { FileCard } from "@/components/FileCard"
import { Search, Plus } from "lucide-react"
import { useEffect, useState, useCallback, useRef } from "react"
import { FileData } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { LoadingCards } from "@/components/LoadingCards"
import { AppLayout } from "@/components/AppLayout"
import { useInView } from "react-intersection-observer"
import debounce from 'lodash/debounce'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AuthPrompt } from '@/components/ui/auth-prompt'

const ITEMS_PER_PAGE = 12

function FilesContent({ onFileSelect }: { onFileSelect: (file: FileData) => void }) {
  const { session, isPreviewMode } = useAuth()
  const [files, setFiles] = useState<FileData[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(0)
  const supabase = createClient()
  const { ref, inView } = useInView()
  const loadingRef = useRef(false)

  const fetchFiles = useCallback(async (pageIndex: number, search: string) => {
    if (loadingRef.current) return
    
    try {
      loadingRef.current = true
      setLoading(true)
      
      let query = supabase
        .from('files')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE - 1)

      if (search) {
        query = query.or(`file_name.ilike.%${search}%,file_type.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      const mappedFiles = (data || []).map(file => ({
        id: file.id,
        name: file.file_name,
        type: file.file_type,
        updated_at: file.updated_at,
        size: file.file_size,
        user_id: file.user_id
      }))

      if (pageIndex === 0) {
        setFiles(mappedFiles)
      } else {
        setFiles(prev => [...prev, ...mappedFiles])
      }

      setHasMore(count ? (pageIndex + 1) * ITEMS_PER_PAGE < count : false)
    } catch (error) {
      console.error('Error fetching files:', error)
    } finally {
      loadingRef.current = false
      setLoading(false)
      setInitialLoad(false)
    }
  }, [supabase])

  const debouncedSearch = useCallback(
    debounce((search: string) => {
      setPage(0)
      fetchFiles(0, search)
    }, 300),
    [fetchFiles]
  )

  useEffect(() => {
    const fetchFiles = async () => {
      if (!session?.user?.id) return
      
      try {
        loadingRef.current = true
        setLoading(true)
        
        let query = supabase
          .from('files')
          .select('*', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .range(0 * ITEMS_PER_PAGE, (0 + 1) * ITEMS_PER_PAGE - 1)

        const { data, error, count } = await query

        if (error) throw error

        const mappedFiles = (data || []).map(file => ({
          id: file.id,
          name: file.file_name,
          type: file.file_type,
          updated_at: file.updated_at,
          size: file.file_size,
          user_id: file.user_id
        }))

        setFiles(mappedFiles)
        setHasMore(count ? (0 + 1) * ITEMS_PER_PAGE < count : false)
      } catch (error) {
        console.error('Error fetching files:', error)
      } finally {
        loadingRef.current = false
        setLoading(false)
        setInitialLoad(false)
      }
    }

    fetchFiles()
  }, [supabase, session?.user?.id])

  useEffect(() => {
    if (!initialLoad) {
      debouncedSearch(searchQuery)
    }
    return () => debouncedSearch.cancel()
  }, [searchQuery, debouncedSearch, initialLoad])

  useEffect(() => {
    if (inView && hasMore && !loadingRef.current) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchFiles(nextPage, searchQuery)
    }
  }, [inView, hasMore, page, fetchFiles, searchQuery])

  if (isPreviewMode) {
    return <AuthPrompt canClose={false} />
  }

  if (initialLoad) {
    return <LoadingCards />
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full relative">
      <div className="max-w-7xl mx-auto px-4 relative z-50">
        <div className="flex items-center gap-4 py-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 h-4 w-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 bg-transparent text-foreground placeholder:text-foreground/50 outline-none"
            />
          </div>
          <button 
            onClick={() => {/* Handle new file */}} 
            className="flex items-center gap-2 text-foreground hover:text-foreground/70 transition-colors"
          >
            <Plus size={16} />
            New File
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-7.5rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <FileCard
                key={file.id}
                name={file.name}
                type={file.type}
                updatedAt={new Date(file.updated_at).toLocaleDateString()}
                onClick={() => onFileSelect(file)}
              />
            ))}
          </div>

          {loading && !initialLoad && <LoadingCards />}
          
          <div ref={ref} className="h-10" />
        </div>
      </div>
    </div>
  )
}

export default function FilesPage() {
  const { isPreviewMode } = useAuth()
  const [showDetails, setShowDetails] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null)
  const [chats, setChats] = useState<any[]>([])
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({})
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const router = useRouter()

  const handleFileSelect = (file: FileData) => {
    setSelectedFile(file)
    setShowDetails(true)
  }

  useEffect(() => {
    const fetchChats = async () => {
      const response = await fetch('/api/chats')
      const data = await response.json()
      setChats(data.chats || [])
    }
    fetchChats()
  }, [])

  if (isPreviewMode) {
    return <AuthPrompt canClose={false} />
  }

  return (
    <AppLayout
      rightPanel={
        selectedFile ? (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">File Details</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-sm">{selectedFile.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="text-sm">{selectedFile.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm">{new Date(selectedFile.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">File Details</h2>
            <p className="text-sm text-muted-foreground">Select a file to view details</p>
          </div>
        )
      }
      showRightPanel={showDetails}
      onToggleRightPanel={() => setShowDetails(!showDetails)}
      chats={chats}
      chatTitles={chatTitles}
      currentChatId={null}
      isCreatingChat={isCreatingChat}
      onChatSelect={(id) => router.push(`/chat/${id}`)}
      onGenerateTitle={async () => null}
      onChatDeleted={() => {
        const fetchChats = async () => {
          const response = await fetch('/api/chats')
          const data = await response.json()
          setChats(data.chats || [])
        }
        fetchChats()
      }}
    >
      <Suspense fallback={<LoadingCards />}>
        <FilesContent onFileSelect={handleFileSelect} />
      </Suspense>
    </AppLayout>
  )
} 
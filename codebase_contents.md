

=== ./middleware.ts ===

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: any) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: any) {
                    request.cookies.delete({
                        name,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.delete({
                        name,
                        ...options,
                    })
                },
            },
        }
    )

    await supabase.auth.getSession()
    return response
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}


=== ./contexts/AuthContext.tsx ===

'use client'

import { createClient } from '@/lib/supabase/client'
import { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'

interface AuthContextType {
    session: Session | null
    isLoading: boolean
    isPreviewMode: boolean
    showAuthPrompt: () => void
    hideAuthPrompt: () => void
    shouldShowAuthPrompt: boolean
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true,
    isPreviewMode: false,
    showAuthPrompt: () => {},
    hideAuthPrompt: () => {},
    shouldShowAuthPrompt: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [shouldShowAuthPrompt, setShouldShowAuthPrompt] = useState(false)
    const supabase = createClient()

    const showAuthPrompt = () => setShouldShowAuthPrompt(true)
    const hideAuthPrompt = () => setShouldShowAuthPrompt(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setIsLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setIsLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    return (
        <AuthContext.Provider
            value={{
                session,
                isLoading,
                isPreviewMode: !session,
                showAuthPrompt,
                hideAuthPrompt,
                shouldShowAuthPrompt,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)


=== ./contexts/ThemeProvider.tsx ===

'use client'

import {
    ThemeProvider as NextThemesProvider,
    type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            {...props}
        >
            {children}
        </NextThemesProvider>
    )
}


=== ./contexts/SidebarContext.tsx ===

'use client'

import { createContext, ReactNode, useContext, useState } from 'react'

interface SidebarContextType {
    collapsed: boolean
    setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(true)

    return (
        <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    const context = useContext(SidebarContext)
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider')
    }
    return context
}


=== ./app/chat/[id]/page.tsx ===

import ChatContainer from '@/components/ChatContainer'
import LoadingAnimation from '@/components/LoadingAnimation'
import { createClient, getUser } from '@/lib/supabase/server'
import { AppVersion } from '@/lib/types'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

interface PageParams {
    params: Promise<{ id: string }>
}

function ChatLoading() {
    return (
        <div className="h-screen w-full flex items-center justify-center">
            <LoadingAnimation message="Loading chat..." />
        </div>
    )
}

export default async function ChatPage({ params }: PageParams) {
    const { id } = await params
    const user = await getUser()

    if (!user) {
        notFound()
    }

    const supabase = await createClient()

    // Parallel fetch of chat and associated data
    const [chatResponse, versionResponse, filesResponse] =
        await Promise.all([
            supabase
                .from('chats')
                .select('*, messages')
                .eq('id', id)
                .single(),
            supabase
                .rpc('get_chat_current_app_version', { p_chat_id: id })
                .single() as unknown as Promise<{
                data: AppVersion[]
                error: any
            }>,
            supabase
                .from('chat_files')
                .select(
                    `
                files (
                    id,
                    file_name,
                    file_type,
                    analysis,
                    created_at
                )
            `
                )
                .eq('chat_id', id),
        ])

    if (chatResponse.error || !chatResponse.data) {
        console.error('Error fetching chat:', chatResponse.error)
        notFound()
    }

    const files =
        filesResponse.data
            ?.map((row) => row.files)
            .filter((file): file is NonNullable<typeof file> => file !== null)
            .map((file) => ({
                ...file,
                analysis: file.analysis as string | null,
            })) ?? []

    // Messages are now directly in the chat object
    const messages = chatResponse.data.messages || []

    console.log('🔄 Messages:', messages)

    return (
        <Suspense fallback={<ChatLoading />}>
            <ChatContainer
                key={id}
                initialChat={chatResponse.data}
                initialMessages={messages}
                initialVersion={versionResponse.data}
                initialFiles={files}
                initialAppId={chatResponse.data.app_id}
                isInChatPage={true}
            />
        </Suspense>
    )
}


=== ./app/auth/callback/route.ts ===

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = await createClient()
        await supabase.auth.exchangeCodeForSession(code)
    }

    return NextResponse.redirect(requestUrl.origin)
}


=== ./app/layout.tsx ===

import { AuthProvider } from '@/contexts/AuthContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/providers/theme-provider'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'py_apps - build & share data apps in seconds',
    description: 'Build streamlit apps with AI',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head />
            <body
                className={cn(
                    inter.className,
                    'antialiased bg-white dark:bg-dark-app'
                )}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <Providers>
                        <AuthProvider>
                            <SidebarProvider>{children}</SidebarProvider>
                        </AuthProvider>
                    </Providers>
                </ThemeProvider>
            </body>
        </html>
    )
}


=== ./app/files/page.tsx ===

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

=== ./app/api/auth/refresh/route.ts ===

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data, error } = await supabase.auth.refreshSession()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ session: data.session, user: data.user })
}


=== ./app/api/auth/logout/route.ts ===

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Logged out successfully' })
}


=== ./app/api/auth/register/route.ts ===

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies })
    const { email, password } = await req.json()

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ user: data.user })
}


=== ./app/api/auth/password-reset/route.ts ===

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { email } = await req.json()

    const { data, error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Password reset email sent' })
}


=== ./app/api/auth/login/route.ts ===

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { email, password } = await req.json()

    const { data, error } = await (
        await supabase
    ).auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ user: data.user, session: data.session })
}


=== ./app/api/sandbox/[id]/kill/route.ts ===

import { getUser } from '@/lib/supabase/server'
import { Sandbox } from 'e2b'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const sandboxId = req.nextUrl.pathname.split('/')[3]
    const sessionId = req.headers.get('x-session-id')
    const user = await getUser()

    try {
        const sandbox = await Sandbox.reconnect(sandboxId)

        // Verify ownership
        if (!user && !sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const metadata = (await Sandbox.list()).find(
            (s) => s.sandboxID === sandboxId
        )?.metadata as any
        if (
            (!user && metadata.sessionId !== sessionId) ||
            (user && metadata.userId !== user.id)
        ) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await sandbox.close()
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error killing sandbox:', error)
        return NextResponse.json(
            { error: 'Failed to kill sandbox' },
            { status: 500 }
        )
    }
}


=== ./app/api/sandbox/[id]/execute/route.ts ===

import { createClient, getUser } from '@/lib/supabase/server'
import { Process, ProcessMessage, Sandbox } from 'e2b'
import { NextRequest, NextResponse } from 'next/server'
import { setupS3Mount } from '@/lib/s3'
interface RouteContext {
    params: Promise<{ id: string }>
}   

export const maxDuration = 30

async function listUserSandboxes(userId: string): Promise<Sandbox[]> {
    try {
        const sandboxes = await Sandbox.list()
        const userSandboxes = sandboxes.filter(
            (s) =>
                s.metadata &&
                typeof s.metadata === 'object' &&
                'userId' in s.metadata &&
                s.metadata.userId === userId
        )

        const fullSandboxes = await Promise.all(
            userSandboxes.map((s) => Sandbox.reconnect(s.sandboxID))
        )
        return fullSandboxes
    } catch (error) {
        console.error('Error listing sandboxes:', error)
        return []
    }
}

async function cleanupOldSandboxes(
    sandboxes: Sandbox[],
    keepSandboxId?: string
) {
    for (const sandbox of sandboxes) {
        if (keepSandboxId && sandbox.id === keepSandboxId) continue
        try {
            await sandbox.close()
            console.log(`Destroyed sandbox ${sandbox.id}`)
        } catch (error) {
            console.error(`Failed to destroy sandbox ${sandbox.id}:`, error)
        }
    }
}

async function killStreamlitProcess(sandbox: Sandbox) {
    try {
        // Kill any running streamlit processes
        await sandbox.process.start({
            cmd: 'pkill -f "streamlit run" || true',
        })

        // Remove existing app file
        await sandbox.process.start({
            cmd: 'rm -f /app/app.py',
        })

        // Small delay to ensure process is fully terminated
        await new Promise((resolve) => setTimeout(resolve, 500))

        console.log('✅ Cleaned up existing Streamlit process and app file')
    } catch (error) {
        console.error('❌ Error during cleanup:', error)
    }
}

// Add new function to list session sandboxes
async function listSessionSandboxes(sessionId: string): Promise<Sandbox[]> {
    try {
        const sandboxes = await Sandbox.list()
        const sessionSandboxes = sandboxes.filter(
            (s) =>
                s.metadata &&
                typeof s.metadata === 'object' &&
                'sessionId' in s.metadata &&
                s.metadata.sessionId === sessionId
        )

        const fullSandboxes = await Promise.all(
            sessionSandboxes.map((s) => Sandbox.reconnect(s.sandboxID))
        )
        return fullSandboxes
    } catch (error) {
        console.error('Error listing session sandboxes:', error)
        return []
    }
}

export async function POST(req: NextRequest, context: RouteContext) {
    const user = await getUser()
    const { id } = await context.params
    const sessionId = req.headers.get('x-session-id')
    const appId = req.headers.get('x-app-id')

    // Get app owner's user ID
    let ownerUserId: string | null = null
    if (appId) {
        const supabase = await createClient()
        const { data: app } = await supabase
            .from('apps')
            .select('user_id')
            .eq('id', appId)
            .single()

        ownerUserId = app?.user_id || null
    }

    if (!ownerUserId && user) {
        ownerUserId = user.id
    }

    if (!ownerUserId) {
        return NextResponse.json(
            { error: 'Could not determine app owner' },
            { status: 400 }
        )
    }

    try {
        const body = await req.json()
        const codeContent =
            typeof body.code === 'object' && body.code.code
                ? body.code.code
                : body.code

        if (!codeContent || typeof codeContent !== 'string') {
            console.error('Invalid code format:', body.code)
            return NextResponse.json(
                { error: 'Invalid code format. Expected string.' },
                { status: 400 }
            )
        }

        let sandbox: Sandbox

        if (user) {
            // Authenticated user flow - keep existing functionality
            const existingSandboxes = await listUserSandboxes(user.id)

            if (id !== 'new' && existingSandboxes.some((s) => s.id === id)) {
                sandbox = await Sandbox.reconnect(id)
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, id)
            } else if (existingSandboxes.length > 0) {
                sandbox = existingSandboxes[0]
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, sandbox.id)
            } else {
                sandbox = await Sandbox.create({
                    apiKey: process.env.E2B_API_KEY!,
                    template: 'streamlit-sandbox-s3',
                    metadata: {
                        userId: user.id,
                    },
                })
            }

            // Keep sandbox alive
            await sandbox.keepAlive(2 * 60 * 1000) // 2 minutes
        } else {
            // Require session ID for unauthenticated users
            if (!sessionId) {
                return NextResponse.json(
                    { error: 'Session ID required for unauthenticated users' },
                    { status: 400 }
                )
            }

            // Handle unauthenticated user flow
            const existingSandboxes = await listSessionSandboxes(sessionId)

            if (id !== 'new' && existingSandboxes.some((s) => s.id === id)) {
                sandbox = await Sandbox.reconnect(id)
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, id)
            } else if (existingSandboxes.length > 0) {
                sandbox = existingSandboxes[0]
                await killStreamlitProcess(sandbox)
                await cleanupOldSandboxes(existingSandboxes, sandbox.id)
            } else {
                sandbox = await Sandbox.create({
                    apiKey: process.env.E2B_API_KEY!,
                    template: 'streamlit-sandbox-s3',
                    metadata: {
                        sessionId,
                        isPublic: 'true',
                        createdAt: new Date().toISOString(),
                    },
                })
                // Keep sandbox alive
                await sandbox.keepAlive(0.5 * 60 * 1000) // 30 seconds
            }
        }

        await setupS3Mount(sandbox, ownerUserId)
        // Write and execute code (common for both flows)
        // console.log('Writing code to sandbox: ', codeContent)
        await sandbox.filesystem.write('/app/app.py', codeContent)

        console.log('Starting Streamlit process')
        await sandbox.process.start({
            cmd: 'streamlit run /app/app.py',
            onStdout: (data: ProcessMessage) =>
                console.log('Streamlit stdout:', data),
            onStderr: (data: ProcessMessage) =>
                console.error('Streamlit stderr:', data),
        })

        const url = sandbox.getHostname(8501)
        console.log('Sandbox URL:', url)

        return NextResponse.json({
            url: `https://${url}`,
            sandboxId: sandbox.id,
        })
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'An unknown error occurred'

        console.error('Sandbox execution error:', {
            error,
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
        })

        return NextResponse.json(
            {
                error: 'Failed to execute code in sandbox',
                details: errorMessage,
            },
            { status: 500 }
        )
    }
}

// Helper function for S3 mount setup


=== ./app/api/files/route.ts ===

import { analyzeCSV } from '@/lib/fileAnalyzer'
import {
    initiateMultipartUpload,
    uploadPart,
    completeMultipartUpload,
    abortMultipartUpload,
    BUCKET_NAME
} from '@/lib/s3'
import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from '@/lib/s3'

// File metadata validation schema
const FileMetadataSchema = z.object({
    fileName: z.string().min(1),
    fileType: z.enum(['csv', 'json', 'txt']),
    fileSize: z.number().max(500 * 1024 * 1024), // 500MB limit
    chatId: z.string().optional(),
})

// Multipart upload initialization schema
const InitUploadSchema = z.object({
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
    chatId: z.string().optional(),
})

// Part upload schema
const PartUploadSchema = z.object({
    uploadId: z.string(),
    partNumber: z.number(),
    key: z.string(),
})

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch files' },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    // Check if this is a multipart upload initialization
    const contentType = req.headers.get('content-type')
    if (contentType?.includes('application/json')) {
        try {
            const body = await req.json()
            const { fileName, fileType, fileSize, chatId } = await InitUploadSchema.parseAsync(body)

            // Validate file metadata
            await FileMetadataSchema.parseAsync({
                fileName,
                fileType: fileType as 'csv' | 'json' | 'txt',
                fileSize,
                chatId,
            })

            // Generate S3 key
            const s3Key = `${user.id}/data/${fileName}`

            // Check for existing file with same name
            const { data: existingFile } = await supabase
                .from('files')
                .select('id, s3_key, upload_id')
                .eq('user_id', user.id)
                .eq('file_name', fileName)
                .single()

            let fileId;
            
            // If file exists, update its details
            if (existingFile) {
                // Abort any existing upload
                if (existingFile.upload_id) {
                    try {
                        await abortMultipartUpload(existingFile.s3_key, existingFile.upload_id)
                    } catch (error) {
                        console.error('Failed to abort existing upload:', error)
                    }
                }

                fileId = existingFile.id;

                // Update existing file record
                const { error: updateError } = await supabase
                    .from('files')
                    .update({
                        file_type: fileType,
                        file_size: fileSize,
                        s3_key: s3Key,
                        upload_status: 'pending',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingFile.id)

                if (updateError) throw updateError
            } else {
                // Create new file record if doesn't exist
                const { data: fileData, error: dbError } = await supabase
                    .from('files')
                    .insert({
                        user_id: user.id,
                        file_name: fileName,
                        file_type: fileType,
                        file_size: fileSize,
                        s3_key: s3Key,
                        upload_status: 'pending'
                    })
                    .select()
                    .single()

                if (dbError) throw dbError
                fileId = fileData.id
            }

            // Initiate new multipart upload
            const uploadId = await initiateMultipartUpload(s3Key, `text/${fileType}`)

            // Update the upload_id
            await supabase
                .from('files')
                .update({ upload_id: uploadId })
                .eq('id', fileId)

            // If chatId provided and file is new, create association
            if (chatId && !existingFile) {
                await supabase.from('chat_files').insert({
                    chat_id: chatId,
                    file_id: fileId,
                })
            }

            return NextResponse.json({
                uploadId,
                key: s3Key,
                fileId: fileId,
                existingFileId: existingFile?.id
            })
        } catch (error) {
            console.error('Failed to initialize upload:', error)
            return NextResponse.json(
                { error: 'Failed to initialize upload' },
                { status: 500 }
            )
        }
    }

    // Handle part upload
    if (contentType?.includes('multipart/form-data')) {
        try {
            const formData = await req.formData()
            const uploadId = formData.get('uploadId') as string
            const partNumber = parseInt(formData.get('partNumber') as string)
            const key = formData.get('key') as string
            const file = formData.get('file') as File

            if (!uploadId || !partNumber || !key || !file) {
                return NextResponse.json(
                    { error: 'Missing required fields' },
                    { status: 400 }
                )
            }

            await PartUploadSchema.parseAsync({ uploadId, partNumber, key })

            const chunk = Buffer.from(await file.arrayBuffer())
            const partResult = await uploadPart(key, uploadId, partNumber, chunk)

            return NextResponse.json(partResult)
        } catch (error) {
            console.error('Failed to upload part:', error)
            return NextResponse.json(
                { error: 'Failed to upload part' },
                { status: 500 }
            )
        }
    }

    return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
    )
}

// Complete multipart upload
export async function PATCH(req: NextRequest) {
    const user = await getUser()
    const supabase = await createClient()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { uploadId, key, parts, fileId } = await req.json()

        // Complete the multipart upload
        const s3Url = await completeMultipartUpload(key, uploadId, parts)

        // Get file info for analysis
        const { data: fileInfo } = await supabase
            .from('files')
            .select('file_name, file_type')
            .eq('id', fileId)
            .single()

        if (!fileInfo) {
            throw new Error('File info not found')
        }

        // Perform analysis for CSV files
        let analysis = null
        if (fileInfo.file_type === 'csv') {
            // Get file content from S3
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            })
            const response = await s3Client.send(command)
            const fileContent = await response.Body!.transformToString()
            
            analysis = await analyzeCSV(fileContent, {
                sampleSize: 1000,
                maxRows: 5,
            })
        }

        // Update file status and analysis in database
        const { error: dbError } = await supabase
            .from('files')
            .update({
                upload_status: 'completed',
                analysis: analysis ? JSON.stringify(analysis) : undefined,
                updated_at: new Date().toISOString(),
            })
            .eq('id', fileId)
            .eq('user_id', user.id)

        if (dbError) throw dbError

        return NextResponse.json({ url: s3Url })
    } catch (error) {
        console.error('Failed to complete upload:', error)
        return NextResponse.json(
            { error: 'Failed to complete upload' },
            { status: 500 }
        )
    }
}

// Abort multipart upload
export async function DELETE(req: NextRequest) {
    const user = await getUser()
    const supabase = await createClient()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { uploadId, key, fileId } = await req.json()

        // Abort the multipart upload
        await abortMultipartUpload(key, uploadId)

        // Update file status in database
        const { error: dbError } = await supabase
            .from('files')
            .update({
                upload_status: 'failed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', fileId)
            .eq('user_id', user.id)

        if (dbError) throw dbError

        return NextResponse.json({ message: 'Upload aborted successfully' })
    } catch (error) {
        console.error('Failed to abort upload:', error)
        return NextResponse.json(
            { error: 'Failed to abort upload' },
            { status: 500 }
        )
    }
}

// Add PUT endpoint for updating chat file associations
export async function PUT(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const { oldFileId, newFileId, chatId } = await req.json()

        // Update all chat associations from old file to new file
        if (oldFileId && newFileId) {
            await supabase
                .from('chat_files')
                .update({ file_id: newFileId })
                .eq('file_id', oldFileId)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update file associations:', error)
        return NextResponse.json(
            { error: 'Failed to update file associations' },
            { status: 500 }
        )
    }
}


=== ./app/api/chats/messages/route.ts ===

import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Fetch messages for a specific chat
export async function GET(req: NextRequest) {
    const user = await getUser()
    const searchParams = req.nextUrl.searchParams
    const chatId = searchParams.get('chatId')

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    if (!chatId) {
        return new Response('Chat ID is required', { status: 400 })
    }

    try {
        const supabase = await createClient()
        const { data: chat, error } = await supabase
            .from('chats')
            .select('messages')
            .eq('id', chatId)
            .eq('user_id', user.id)
            .single()

        if (error) throw error

        // Return the messages array directly from the chat object
        return NextResponse.json({ messages: chat?.messages || [] })
    } catch (error) {
        console.error('Failed to fetch messages:', error)
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        )
    }
}


=== ./app/api/chats/stream/route.ts ===

import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'
import { createClient, getUser } from '@/lib/supabase/server'
import { streamlitTool } from '@/lib/tools/streamlit'
import { anthropic } from '@ai-sdk/anthropic'
import { Message, streamText } from 'ai'

export const maxDuration = 150

interface StreamlitToolCall {
    toolCallId: string
    toolName: string
    args: {
        code: string
        appName: string
        appDescription: string
    }
}

interface FileContext {
    fileName: string
    fileType: string
    analysis: string
}

// Chat Management
async function createNewChat(supabase: any, userId: string, chatName: string) {
    const { data: chat, error } = await supabase
        .from('chats')
        .insert([{ user_id: userId, name: chatName }])
        .select()
        .single()

    if (error) throw error
    return chat
}

async function linkFileToChat(supabase: any, chatId: string, fileId: string) {
    const { error } = await supabase
        .from('chat_files')
        .insert([{ chat_id: chatId, file_id: fileId }])

    if (error) {
        console.error('Error associating file with chat:', error)
        return false
    }
    return true
}

// File Management
async function getFileContext(
    supabase: any,
    chatId: string | undefined,
    userId: string
): Promise<Set<FileContext> | undefined> {
    if (!chatId) return undefined

    // Get all files associated with the chat
    const { data: chatFiles, error } = await supabase
        .from('chat_files')
        .select(`
            files (
                file_name,
                file_type,
                analysis,
                user_id
            )
        `)
        .eq('chat_id', chatId)
        .filter('files.user_id', 'eq', userId)

    if (error || !chatFiles?.length) return undefined

    // Create a Map to store unique files by fileName
    const uniqueFiles = new Map<string, FileContext>()
    
    chatFiles.forEach((row: any) => {
        const file = row.files
        if (file && file.file_name) {
            uniqueFiles.set(file.file_name, {
                fileName: file.file_name,
                fileType: file.file_type,
                analysis: file.analysis || '',
            })
        }
    })

    const files = Array.from(uniqueFiles.values())
    return files.length > 0 ? new Set(files) : undefined
}

// Message Management

// App Version Management
async function getNextVersionNumber(
    supabase: any,
    appId: string
): Promise<number> {
    const { data } = await supabase
        .from('app_versions')
        .select('version_number')
        .eq('app_id', appId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

    return (data?.version_number || 0) + 1
}

async function getCurrentAppVersion(supabase: any, appId: string) {
    const { data: app } = await supabase
        .from('apps')
        .select('current_version_id')
        .eq('id', appId)
        .single()

    if (!app?.current_version_id) return null

    const { data: version } = await supabase
        .from('app_versions')
        .select('code')
        .eq('id', app.current_version_id)
        .single()

    return version
}

async function createNewApp(
    supabase: any,
    userId: string,
    name: string,
    description: string
) {
    const { data: app } = await supabase
        .from('apps')
        .insert({
            user_id: userId,
            name,
            description,
            is_public: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: userId,
        })
        .select()
        .single()

    return app
}

async function createAppVersion(
    supabase: any,
    appId: string,
    versionNumber: number,
    code: string,
    name: string,
    description: string
) {
    const { data: version } = await supabase
        .from('app_versions')
        .insert({
            app_id: appId,
            version_number: versionNumber,
            code,
            created_at: new Date().toISOString(),
            name,
            description,
        })
        .select()
        .single()

    return version
}

async function updateAppCurrentVersion(
    supabase: any,
    appId: string,
    versionId: string
) {
    await supabase
        .from('apps')
        .update({
            current_version_id: versionId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', appId)
}

async function handleStreamlitAppVersioning(
    supabase: any,
    userId: string,
    chatId: string,
    toolCall: StreamlitToolCall
): Promise<string | null> {
    if (!toolCall.args) return null

    const { code, appName, appDescription } = toolCall.args

    // Check for existing app
    const { data: chat } = await supabase
        .from('chats')
        .select('app_id')
        .eq('id', chatId)
        .single()

    let appId = chat?.app_id

    if (!appId) {
        // Create new app flow
        const app = await createNewApp(
            supabase,
            userId,
            appName || 'Untitled App',
            appDescription || ''
        )
        appId = app.id

        const version = await createAppVersion(
            supabase,
            appId,
            1,
            code,
            appName || 'Version 1',
            appDescription || ''
        )

        await Promise.all([
            updateAppCurrentVersion(supabase, appId, version.id),
            linkChatToApp(supabase, chatId, appId),
        ])
    } else {
        // Update existing app flow
        const currentVersion = await getCurrentAppVersion(supabase, appId)

        if (currentVersion?.code !== code) {
            const nextVersion = await getNextVersionNumber(supabase, appId)

            const version = await createAppVersion(
                supabase,
                appId,
                nextVersion,
                code,
                appName || `Version ${nextVersion}`,
                appDescription || ''
            )

            await updateAppCurrentVersion(supabase, appId, version.id)
        }
    }

    return appId
}

async function linkChatToApp(supabase: any, chatId: string, appId: string) {
    await supabase.from('chats').update({ app_id: appId }).eq('id', chatId)
}

function buildSystemPrompt(fileContexts: Set<FileContext> | undefined): string {
    if (!fileContexts?.size) return CHAT_SYSTEM_PROMPT

    // Convert Set to Array and remove duplicates based on fileName
    const uniqueContexts = Array.from(
        new Map(
            Array.from(fileContexts).map(context => [context.fileName, context])
        ).values()
    )

    const fileDescriptions = uniqueContexts
        .map(context => 
            `- A ${context.fileType.toUpperCase()} file named "${context.fileName}" in the directory "/app/s3/data/${context.fileName}". Analysis: ${context.analysis}`
        )
        .join('\n')

    return `${CHAT_SYSTEM_PROMPT}\n\nYou are working with the following files:\n${fileDescriptions}`
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        console.log('❌ Unauthorized user')
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const { messages, chatId, fileId, fileIds } = await req.json()
        let newChatId = chatId
        let appId: string | null = null

        // Initialize chat if needed
        if (!chatId) {
            const chat = await createNewChat(
                supabase,
                user.id,
                messages[messages.length - 1]?.content?.slice(0, 100) ||
                    'New Chat'
            )
            newChatId = chat.id
        }

        // Handle file associations
        if (fileId && newChatId) {
            await linkFileToChat(supabase, newChatId, fileId)
        }
        if (fileIds?.length && newChatId) {
            await Promise.all(
                fileIds.map((fId: string) => linkFileToChat(supabase, newChatId, fId))
            )
        }

        // Get file contexts if needed
        const fileContexts = await getFileContext(supabase, newChatId, user.id)
        const systemPrompt = buildSystemPrompt(fileContexts)

        console.log('🔍 Streaming with fileContexts:', fileContexts)
        const result = streamText({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            tools: { streamlitTool },
            maxSteps: 5,
            experimental_toolCallStreaming: true,
            onFinish: async (event) => {
                const { response } = event
                if (!response?.messages?.length) return

                try {
                    // Combine existing and new messages
                    const allMessages = [...messages, ...response.messages]
                    console.log('💾 Processing messages:', JSON.stringify(allMessages, null, 2))

                    // Validate messages
                    const validMessages = allMessages.filter(msg => {
                        if (msg.role !== 'assistant' && msg.role !== 'user') return true;
                        if (Array.isArray(msg.content)) {
                            return msg.content.length > 0;
                        }
                        return typeof msg.content === 'string' && msg.content.trim().length > 0;
                    });

                    // Find all assistant messages with tool calls
                    const streamlitCalls = validMessages
                        .filter(msg => msg.role === 'assistant' && Array.isArray(msg.content))
                        .flatMap(msg => msg.content)
                        .filter((content: any) => 
                            content.type === 'tool-call' && 
                            content.toolName === 'streamlitTool' &&
                            content.args?.code
                        )

                    // Get the latest Streamlit call
                    const latestStreamlitCall = streamlitCalls[streamlitCalls.length - 1]
                    console.log('🔍 Latest Streamlit call:', JSON.stringify(latestStreamlitCall, null, 2))

                    if (latestStreamlitCall) {
                        // Transform to expected format
                        const transformedCall = {
                            toolCallId: latestStreamlitCall.toolCallId,
                            toolName: latestStreamlitCall.toolName,
                            args: latestStreamlitCall.args
                        }
                        console.log('✨ Creating app version with:', JSON.stringify(transformedCall, null, 2))

                        appId = await handleStreamlitAppVersioning(
                            supabase,
                            user.id,
                            newChatId,
                            transformedCall
                        )
                        console.log('✅ Created app with ID:', appId)
                    }

                    // Store all messages
                    await supabase
                        .from('chats')
                        .update({
                            updated_at: new Date().toISOString(),
                            messages: validMessages,
                        })
                        .eq('id', newChatId)
                        .eq('user_id', user.id)

                    console.log('✅ Successfully stored messages')
                } catch (error) {
                    console.error('❌ Error in message handling:', error)
                    throw error
                }
            },
        })

        return result.toDataStreamResponse({
            headers: {
                'x-chat-id': newChatId,
                'x-app-id': appId || '',
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        })
    } catch (error) {
        console.error('❌ Error in stream route:', error)
        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        )
    }
}

export const runtime = 'nodejs'

=== ./app/api/chats/route.ts ===

import { createClient, getUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Fetch all conversations for the authenticated user
export async function GET() {
    const user = await getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const supabase = await createClient()
        const { data: chats, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ chats })
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch conversations' },
            { status: 500 }
        )
    }
}

// Create a new conversation
export async function POST(req: Request) {
    const user = await getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        const supabase = await createClient()
        const body = await req.json()

        const { data: chat, error } = await supabase
            .from('chats')
            .insert({
                user_id: user.id,
                name: 'New Project',
            })
            .select()
            .single()

        if (error) {
            console.log('ERROR:', error)
            throw error
        }

        return NextResponse.json(chat)
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create conversation' },
            { status: 500 }
        )
    }
}


=== ./app/api/chats/files/routes.ts ===

import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const ChatFileSchema = z.object({
    chatId: z.string().min(1),
    fileId: z.string().min(1),
})

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json()

        // Validate request body
        const { chatId, fileId } = await ChatFileSchema.parseAsync(body)

        // Create chat-file association
        const { data, error } = await supabase
            .from('chat_files')
            .insert({
                chat_id: chatId,
                file_id: fileId,
                created_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        console.error('Failed to create chat-file association:', error)
        return NextResponse.json(
            { error: 'Failed to create chat-file association' },
            { status: 500 }
        )
    }
}

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const user = await getUser()

    const { chatId } = await req.json()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    const { data, error } = await supabase
        .from('chat_files')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json(data)
}


=== ./app/api/chats/files/route.ts ===

import { createClient, getUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const FileAssociationSchema = z.object({
    chatId: z.string(),
    fileId: z.string(),
})

export async function POST(req: Request) {
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json()
        const { chatId, fileId } = await FileAssociationSchema.parseAsync(body)

        // Verify chat ownership
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', chatId)
            .eq('user_id', user.id)
            .single()

        if (chatError || !chat) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            )
        }

        // Create new association
        const { error } = await supabase
            .from('chat_files')
            .insert({
                chat_id: chatId,
                file_id: fileId,
            })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to link file to chat:', error)
        return NextResponse.json(
            { error: 'Failed to link file to chat' },
            { status: 500 }
        )
    }
} 

=== ./app/api/chats/[id]/title/route.ts ===

import { createClient, getUser } from '@/lib/supabase/server'
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params
    const supabase = await createClient()
    const user = await getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get chat messages directly from chats table
        const { data: chat, error } = await supabase
            .from('chats')
            .select('messages')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error) throw error
        if (!chat?.messages?.length) {
            return NextResponse.json(
                { title: 'New Chat' },
                { status: 200 }
            )
        }

        // Get the first user message
        const firstUserMessage = chat.messages.find(m => m.role === 'user')
        if (!firstUserMessage) {
            return NextResponse.json(
                { title: 'New Chat' },
                { status: 200 }
            )
        }

        // Generate title using AI with schema validation
        const { object } = await generateObject({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [
                {
                    role: 'system',
                    content: 'You are a project title generator. Generate concise, descriptive titles based on conversation content.'
                },
                {
                    role: 'user',
                    content: firstUserMessage.content
                }
            ],
            schema: z.object({
                title: z
                    .string()
                    .max(50)
                    .describe('Generate a 6-word title that captures the essence of the conversation')
            }),
            temperature: 0.7
        })

        // Update chat title
        const { error: updateError } = await supabase
            .from('chats')
            .update({ name: object.title || 'New Chat' })
            .eq('id', id)
            .eq('user_id', user.id)

        if (updateError) throw updateError

        return NextResponse.json({ title: object.title || 'New Chat' })
    } catch (error) {
        console.error('Error generating title:', error)
        return NextResponse.json(
            { error: 'Failed to generate title' },
            { status: 500 }
        )
    }
}


=== ./app/api/chats/[id]/route.ts ===

import { createClient, getUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: chat, error } = await supabase
        .from('chats')
        .select(
            `
            *,
            app:app_id (
                id
            )
        `
        )
        .eq('id', id)
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'Failed to fetch chat' },
            { status: 500 }
        )
    }

    return NextResponse.json({ chat })
}

export async function DELETE(request: Request, context: RouteContext) {
    const { id } = await context.params
    const user = await getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    try {
        // 1. Verify chat ownership and get app_id
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('app_id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (chatError) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            )
        }

        // 2. If chat has an app, handle app cleanup
        if (chat.app_id) {
            // First, clear current_version_id from app
            const { error: updateError } = await supabase
                .from('apps')
                .update({ current_version_id: null })
                .eq('id', chat.app_id)
                .eq('user_id', user.id)

            if (updateError) throw updateError

            // Then clear app_id from chat to remove the foreign key constraint
            const { error: chatUpdateError } = await supabase
                .from('chats')
                .update({ app_id: null })
                .eq('id', id)
                .eq('user_id', user.id)

            if (chatUpdateError) throw chatUpdateError
        }

        // Delete messages associated with the chat
        const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .eq('chat_id', id)

        if (messagesError) throw messagesError

        // Delete chat-file associations
        const { error: chatFilesError } = await supabase
            .from('chat_files')
            .delete()
            .eq('chat_id', id)

        if (chatFilesError) throw chatFilesError

        // Delete app-related data if needed
        if (chat.app_id) {
            // Delete app versions
            const { error: versionsError } = await supabase
                .from('app_versions')
                .delete()
                .eq('app_id', chat.app_id)

            if (versionsError) throw versionsError

            // Delete the app
            const { error: appError } = await supabase
                .from('apps')
                .delete()
                .eq('id', chat.app_id)
                .eq('user_id', user.id)

            if (appError) throw appError
        }

        // Finally delete the chat itself
        const { error: deleteError } = await supabase
            .from('chats')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (deleteError) throw deleteError

        return NextResponse.json({
            message: 'Chat and related data deleted successfully',
        })
    } catch (error) {
        console.error('Delete error:', error)
        return NextResponse.json(
            { error: 'Failed to delete chat and related data' },
            { status: 500 }
        )
    }
}


=== ./app/api/chats/[id]/files/route.ts ===

import { createClient, getUser } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
// Validation schema
const FileAssociationSchema = z.object({
    fileIds: z.array(z.string()),
})

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const user = await getUser()
    const { id } = await context.params

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json()
        const { fileIds } = await FileAssociationSchema.parseAsync(body)

        // Verify chat ownership
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (chatError || !chat) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            )
        }

        // Delete existing associations
        await supabase
            .from('chat_files')
            .delete()
            .eq('chat_id', id)

        // Create new associations
        if (fileIds.length > 0) {
            const { error } = await supabase.from('chat_files').insert(
                fileIds.map((fileId) => ({
                    chat_id: id,
                    file_id: fileId,
                }))
            )

            if (error) throw error
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update file associations:', error)
        return NextResponse.json(
            { error: 'Failed to update file associations' },
            { status: 500 }
        )
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const user = await getUser()
    const { id } = await context.params

    if (!user) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    try {
        // First verify chat ownership
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (chatError || !chat) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            )
        }

        const { data, error } = await supabase
            .from('chat_files')
            .select(
                `
                file_id,
                files (
                    id,
                    file_name,
                    file_type,
                    created_at
                )
            `
            )
            .eq('chat_id', id)

        if (error) throw error

        const files = data
            .map((row: any) => row.files)
            .filter((file: any) => file !== null)

        return NextResponse.json(files)
    } catch (error) {
        console.error('Failed to fetch chat files:', error)
        return NextResponse.json(
            { error: 'Failed to fetch chat files' },
            { status: 500 }
        )
    }
} 

=== ./app/page.tsx ===

'use client'

import ChatContainer from '@/components/ChatContainer'

export default function Home() {
    return <ChatContainer isNewChat={true} />
}


=== ./app/apps/[id]/page.tsx ===

import { createClient, getUser } from '@/lib/supabase/server'
import { AppVersion } from '@/lib/types'
import { notFound } from 'next/navigation'
import { AppClient } from './AppClient'

interface PageParams {
    params: Promise<{ id: string }>
}

export default async function AppPage({ params }: PageParams) {
    const { id } = await params
    const user = await getUser()
    const supabase = await createClient()

    // Get the app data
    const { data: app, error } = await supabase
        .rpc('get_app_versions', { p_app_id: id })
        .select()

    if (error || !app || app.length === 0) {
        console.error('Error fetching app:', error?.message)
        notFound()
    }

    // Return AppClient with user context
    return <AppClient app={app[0] as AppVersion} id={id} />
}


=== ./app/apps/[id]/AppClient.tsx ===

'use client'

import { AppHeader } from '@/components/AppHeader'
import { CodeView } from '@/components/CodeView'
import { StreamlitFrame, StreamlitFrameRef } from '@/components/StreamlitFrame'
import { AuthPrompt } from '@/components/ui/auth-prompt'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { AppVersion } from '@/lib/types'
import { Circle, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface AppClientProps {
    app: AppVersion
    id: string
}

export function AppClient({ app, id }: AppClientProps) {
    const { updateSandbox, streamlitUrl, isLoadingSandbox } = useSandboxStore()
    const streamlitRef = useRef<StreamlitFrameRef>(null)
    const [showCode, setShowCode] = useState(false)
    const { showAuthPrompt, session, shouldShowAuthPrompt } = useAuth()

    useEffect(() => {
        // Initialize sandbox when component mounts
        const initSandbox = async () => {
            await updateSandbox(app.code, true, id) // Force execute to match previous behavior
        }
        initSandbox()
    }, []) // Empty dependency array to run only on mount, like before

    useEffect(() => {
        // Show auth prompt after 10 seconds if user is not authenticated
        if (!session) {
            const timer = setTimeout(() => {
                showAuthPrompt()
            }, 30000) // 30 seconds

            return () => clearTimeout(timer)
        }
    }, [session, showAuthPrompt])

    const CustomHandle = ({ ...props }) => (
        <ResizableHandle
            {...props}
            withHandle
            className="relative bg-transparent w-[6px] transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[3px] h-64 bg-neutral-200/50 dark:bg-neutral-800/50" />
            </div>
        </ResizableHandle>
    )

    return (
        <ThemeProvider>
            <div className="min-h-screen flex flex-col bg-white dark:bg-dark-app">
                {shouldShowAuthPrompt && <AuthPrompt canClose={false} />}
                <AppHeader
                    appId={id}
                    appName={app.name || ''}
                    appDescription={app.description || undefined}
                    initialVersions={[app]}
                    initialUrl={streamlitUrl || ''}
                    streamlitRef={streamlitRef}
                    onToggleCode={() => setShowCode(!showCode)}
                />
                <main className="flex-1">
                    <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel defaultSize={showCode ? 60 : 100}>
                            <div className="h-[calc(100vh-3.5rem)]">
                                {!streamlitUrl ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-dark-app/50 backdrop-blur-sm">
                                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                                    </div>
                                ) : (
                                    <StreamlitFrame
                                        ref={streamlitRef}
                                        url={streamlitUrl}
                                    />
                                )}
                            </div>
                        </ResizablePanel>
                        {showCode && (
                            <>
                                <CustomHandle />
                                <ResizablePanel
                                    defaultSize={40}
                                    minSize={30}
                                    maxSize={70}
                                >
                                    <div className="h-[calc(100vh-3.5rem)]">
                                        <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-900">
                                            {/* Terminal Header */}
                                            <div className="h-8 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 flex items-center px-3 gap-1">
                                                <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                                                <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                                                <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
                                                <div className="flex-1 flex justify-center">
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                                        app.py
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Terminal Content */}
                                            <div className="flex-1 overflow-y-auto">
                                                <CodeView
                                                    code={app.code || ''}
                                                    isGeneratingCode={false}
                                                    language="python"
                                                    className="overflow-auto p-4"
                                                    containerClassName="border-none shadow-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </ResizablePanel>
                            </>
                        )}
                    </ResizablePanelGroup>
                </main>
            </div>
        </ThemeProvider>
    )
}


=== ./app/apps/page.tsx ===

'use client'

import { Suspense } from 'react'
import { AppCard } from "@/components/AppCard";
import { Search, Plus, Filter } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppData } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { LoadingCards } from "@/components/LoadingCards";
import { AppLayout } from "@/components/AppLayout";
import { useInView } from "react-intersection-observer";
import debounce from 'lodash/debounce';
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { AuthPrompt } from '@/components/ui/auth-prompt'

const ITEMS_PER_PAGE = 12;

function AppsContent({ onAppSelect }: { onAppSelect: (app: AppData) => void }) {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const supabase = createClient();
  const { ref, inView } = useInView();
  const loadingRef = useRef(false);
  const { session, isPreviewMode } = useAuth();
  const router = useRouter();

  const fetchApps = useCallback(async (pageIndex: number, search: string) => {
    if (loadingRef.current || !session?.user?.id) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      
      let query = supabase
        .from('apps')
        .select('*', { count: 'exact' })
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .range(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      if (pageIndex === 0) {
        setApps(data || []);
      } else {
        setApps(prev => [...prev, ...(data || [])]);
      }

      setHasMore(count ? (pageIndex + 1) * ITEMS_PER_PAGE < count : false);
    } catch (error) {
      console.error('Error fetching apps:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoad(false);
    }
  }, [supabase, session?.user?.id]);

  const debouncedSearch = useCallback(
    debounce((search: string) => {
      setPage(0);
      fetchApps(0, search);
    }, 300),
    [fetchApps]
  );

  useEffect(() => {
    const fetchApps = async () => {
      if (!session?.user?.id) return
      
      try {
        loadingRef.current = true
        setLoading(true)
        
        let query = supabase
          .from('apps')
          .select('*', { count: 'exact' })
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
          .range(0 * ITEMS_PER_PAGE, (0 + 1) * ITEMS_PER_PAGE - 1)

        const { data, error, count } = await query

        if (error) throw error

        setApps(data || [])
        setHasMore(count ? (0 + 1) * ITEMS_PER_PAGE < count : false)
      } catch (error) {
        console.error('Error fetching apps:', error)
      } finally {
        loadingRef.current = false
        setLoading(false)
        setInitialLoad(false)
      }
    }

    fetchApps()
  }, [supabase, session?.user?.id])

  useEffect(() => {
    if (!initialLoad) {
      debouncedSearch(searchQuery);
    }
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch, initialLoad]);

  useEffect(() => {
    if (inView && hasMore && !loadingRef.current) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchApps(nextPage, searchQuery);
    }
  }, [inView, hasMore, page, fetchApps, searchQuery]);

  if (isPreviewMode) {
    return <AuthPrompt canClose={false} />
  }

  if (initialLoad) {
    return <LoadingCards />;
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full relative">
      <div className="max-w-7xl mx-auto px-4 relative z-50">
        <div className="flex items-center gap-4 py-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 h-4 w-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 bg-transparent text-foreground placeholder:text-foreground/50 outline-none"
            />
          </div>
          <button
            onClick={() => router.push('/')} 
            className="flex items-center gap-2 text-foreground hover:text-foreground/70 transition-colors"
          >
            <Plus size={16} />
            New App
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-7.5rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <AppCard
                key={app.id}
                name={app.name}
                description={app.description}
                updatedAt={new Date(app.updated_at).toLocaleDateString()}
                onClick={() => {
                  router.push(`/apps/${app.id}`)
                  onAppSelect?.(app)
                }}
              />
            ))}
          </div>

          {loading && !initialLoad && <LoadingCards />}
          
          <div ref={ref} className="h-10" />
        </div>
      </div>
    </div>
  );
}

export default function AppsPage() {
  const [showDetails, setShowDetails] = useState(false)
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null)
  const [chats, setChats] = useState<any[]>([])
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({})
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const router = useRouter()

  const handleAppSelect = (app: AppData) => {
    setSelectedApp(app)
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

  return (
    <AppLayout
      rightPanel={
        selectedApp ? (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">App Details</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-sm">{selectedApp.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm">{selectedApp.description || 'No description'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm">{new Date(selectedApp.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">App Details</h2>
            <p className="text-sm text-muted-foreground">Select an app to view details</p>
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
        <AppsContent onAppSelect={handleAppSelect} />
      </Suspense>
    </AppLayout>
  )
} 

=== ./app/providers.tsx ===

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}


=== ./providers/theme-provider.tsx ===

'use client'

import {
    ThemeProvider as NextThemesProvider,
    type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            {...props}
        >
            {children}
        </NextThemesProvider>
    )
}


=== ./next-env.d.ts ===

/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.


=== ./tailwind.config.ts ===

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                sidebar: {
                    DEFAULT: 'hsl(var(--sidebar-background))',
                    foreground: 'hsl(var(--sidebar-foreground))',
                    primary: 'hsl(var(--sidebar-primary))',
                    'primary-foreground':
                        'hsl(var(--sidebar-primary-foreground))',
                    accent: 'hsl(var(--sidebar-accent))',
                    'accent-foreground':
                        'hsl(var(--sidebar-accent-foreground))',
                    border: 'hsl(var(--sidebar-border))',
                    ring: 'hsl(var(--sidebar-ring))',
                    dark: {
                        background: '#0F0F10',
                        foreground: '#f5f5f5',
                        accent: '#262626',
                        'accent-foreground': '#f5f5f5',
                        border: '#262626',
                        ring: '#404040',
                    },
                },
                dark: {
                    background: '#0F0F10',
                    text: '#f5f5f5',
                    border: 'rgb(115 115 115)',
                    textAreaBorder: '#262626',
                },
            },
            backgroundColor: {
                'dark-app': '#0F0F10',
            },
            textColor: {
                'dark-text': '#f5f5f5',
            },
            borderColor: {
                'dark-border': 'rgb(115 115 115)',
            },
            borderRadius: {
                base: '15px',
            },
            boxShadow: {
                light: '4px 4px 0px 0px #000',
                dark: '4px 4px 0px 0px #000',
            },
            translate: {
                boxShadowX: '4px',
                boxShadowY: '4px',
                reverseBoxShadowX: '-4px',
                reverseBoxShadowY: '-4px',
            },
            fontWeight: {
                base: '500',
                heading: '700',
            },
            keyframes: {
                blink: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'cursor-blink': {
                    '0%, 100%': {
                        opacity: '1',
                        borderRightColor: 'currentColor',
                    },
                    '50%': {
                        opacity: '0',
                        borderRightColor: 'transparent',
                    },
                },
            },
            animation: {
                blink: 'blink 1s step-end infinite',
                'fade-in': 'fade-in 0.5s ease-in',
                'cursor-blink': 'cursor-blink 1.2s step-end infinite',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
}


=== ./components/PreviewPanel.tsx ===

import {
    StreamlitPreview,
    StreamlitPreviewRef,
} from '@/components/StreamlitPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { AnimatePresence } from 'framer-motion'
import { Code, Globe, Layout, RefreshCcw } from 'lucide-react'
import dynamic from 'next/dynamic'
import React, { useRef } from 'react'
import { CodeView } from './CodeView'

// Dynamically import LoadingSandbox with SSR disabled
const LoadingAnimation = dynamic(() => import('./LoadingAnimation'), {
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="animate-pulse">Loading...</div>
        </div>
    ),
})

interface PreviewPanelProps {
    streamlitUrl: string | null
    appId?: string
    generatedCode: string
    isGeneratingCode: boolean
    isLoadingSandbox: boolean
    showCodeView: boolean
    onRefresh: () => void
    onCodeViewToggle: () => void
}

export const PreviewPanel = React.forwardRef<
    { refreshIframe: () => void },
    PreviewPanelProps
>(
    (
        {
            streamlitUrl,
            appId,
            generatedCode,
            isGeneratingCode,
            isLoadingSandbox,
            showCodeView,
            onRefresh,
            onCodeViewToggle,
        },
        ref
    ) => {
        const streamlitPreviewRef = useRef<StreamlitPreviewRef>(null)

        React.useImperativeHandle(ref, () => ({
            refreshIframe: () => {
                if (streamlitPreviewRef.current) {
                    streamlitPreviewRef.current.refreshIframe()
                }
            },
        }))
        const showOverlay = isGeneratingCode || isLoadingSandbox

        const displayUrl = appId
            ? `${process.env.NEXT_PUBLIC_BASE_URL || ''}/apps/${appId}`
            : null

        const handleRefresh = () => {
            if (streamlitPreviewRef.current) {
                streamlitPreviewRef.current.refreshIframe()
            }
            onRefresh?.()
        }

        return (
            <div className="relative flex flex-col h-full z-40">
                <AnimatePresence>
                    {showOverlay && (
                        <LoadingAnimation
                            message={
                                isLoadingSandbox
                                    ? 'Preparing your sandbox...'
                                    : isGeneratingCode
                                      ? 'Creating your app...' // Use same message for both states
                                      : 'Loading...'
                            }
                        />
                    )}
                </AnimatePresence>
                <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 p-2 border-b bg-muted/40">
                        <div className="flex items-center flex-grow gap-2 px-2 py-1.5 bg-background rounded-md border shadow-sm">
                            <Globe className="h-4 w-4 text-foreground/90" />
                            <Input
                                value={displayUrl || ''}
                                readOnly
                                className="flex-grow font-mono text-sm border-0 focus-visible:ring-0 px-0 py-0 h-auto bg-transparent text-foreground selection:bg-blue-200"
                            />
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRefresh}
                                        className="hover:bg-background"
                                        disabled={isGeneratingCode}
                                    >
                                        <RefreshCcw
                                            className={cn(
                                                'h-4 w-4 text-foreground/90',
                                                isGeneratingCode &&
                                                    'animate-spin'
                                            )}
                                        />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>Refresh App</p>
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={onCodeViewToggle}
                                        className={cn(
                                            'hover:bg-background',
                                            showCodeView &&
                                                'bg-background text-primary'
                                        )}
                                    >
                                        {showCodeView ? (
                                            <Layout className="h-4 w-4 text-foreground/90" />
                                        ) : (
                                            <Code className="h-4 w-4 text-foreground/90" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>
                                        {showCodeView
                                            ? 'Show App'
                                            : 'Show Code'}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="flex-1 min-h-0">
                        {showCodeView ? (
                            <div className="h-full">
                                {isGeneratingCode ? (
                                    <LoadingAnimation message="Generating code..." />
                                ) : (
                                    <CodeView
                                        code={generatedCode}
                                        isGeneratingCode={isGeneratingCode}
                                        containerClassName="h-full"
                                    />
                                )}
                            </div>
                        ) : (
                            <StreamlitPreview
                                ref={streamlitPreviewRef}
                                url={streamlitUrl}
                                isGeneratingCode={isGeneratingCode}
                            />
                        )}
                    </div>
                </div>
            </div>
        )
    }
)

PreviewPanel.displayName = 'PreviewPanel'


=== ./components/ui/auth-prompt.tsx ===

import { Logo } from '@/components/core/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function AuthPrompt({ canClose = true }) {
    const { hideAuthPrompt } = useAuth()
    const supabase = createClient()
    const [isDarkMode, setIsDarkMode] = useState(false)

    useEffect(() => {
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }, [])

    const handleGoogleSignIn = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `https://pyapps.co/auth/callback`,
            },
        })
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
                onClick={canClose ? hideAuthPrompt : undefined}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="w-full max-w-md relative"
                    onClick={canClose ? (e) => e.stopPropagation() : undefined}
                >
                    <Card className="relative border-0 shadow-2xl overflow-hidden rounded-2xl bg-background/50 backdrop-blur-sm ring-1 ring-border/10">
                        <div className="absolute inset-0">
                            <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/10 via-transparent to-blue-500/10 dark:from-rose-500/5 dark:to-blue-500/5 animate-gradient" />
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-emerald-500/10 dark:from-purple-500/5 dark:to-emerald-500/5 animate-gradient delay-100" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background/50 to-background" />
                        </div>

                        <CardHeader className="relative z-10">
                            <div className="flex justify-end items-center">
                                {canClose && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={hideAuthPrompt}
                                        className="text-muted-foreground hover:bg-red-500/10 h-8 w-8"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-8 pb-8 relative z-10 px-8">
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="space-y-4 text-center"
                            >
                                <h2 className="text-2xl font-bold tracking-tight flex justify-center items-center">
                                    <motion.div
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                        className="relative"
                                    >
                                        <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/20 via-blue-500/20 to-purple-500/20 blur-sm" />
                                        <Logo
                                            inverted={isDarkMode}
                                            className="w-32 relative"
                                        />
                                    </motion.div>
                                </h2>
                                <h3 className="text-pretty text-muted-foreground/80 text-base">
                                    Build Python data apps in seconds!
                                </h3>
                            </motion.div>
                        </CardContent>

                        <CardFooter className="relative z-10 pb-8 px-8">
                            <motion.div
                                className="w-full"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <Button
                                    size="lg"
                                    variant="secondary"
                                    className="w-full relative group hover:opacity-90 transition-all duration-200 rounded-xl border shadow-sm bg-background/80 backdrop-blur-sm hover:shadow-md hover:scale-[1.02]"
                                    onClick={handleGoogleSignIn}
                                >
                                    <div className="absolute left-4">
                                        <svg
                                            className="w-5 h-5"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                    </div>
                                    <span className="font-medium">
                                        Continue with Google
                                    </span>
                                </Button>
                            </motion.div>
                        </CardFooter>
                    </Card>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}


=== ./components/ui/alert-dialog.tsx ===

'use client'

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import * as React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Overlay
        className={cn(
            'fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
        )}
        {...props}
        ref={ref}
    />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
    <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-neutral-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg dark:border-neutral-800 dark:bg-neutral-950',
                className
            )}
            {...props}
        />
    </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col space-y-2 text-center sm:text-left',
            className
        )}
        {...props}
    />
)
AlertDialogHeader.displayName = 'AlertDialogHeader'

const AlertDialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
            className
        )}
        {...props}
    />
)
AlertDialogFooter.displayName = 'AlertDialogFooter'

const AlertDialogTitle = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Title
        ref={ref}
        className={cn('text-lg font-semibold', className)}
        {...props}
    />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Description
        ref={ref}
        className={cn(
            'text-sm text-neutral-500 dark:text-neutral-400',
            className
        )}
        {...props}
    />
))
AlertDialogDescription.displayName =
    AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Action>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Action
        ref={ref}
        className={cn(buttonVariants(), className)}
        {...props}
    />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Cancel
        ref={ref}
        className={cn(
            buttonVariants({ variant: 'outline' }),
            'mt-2 sm:mt-0',
            className
        )}
        {...props}
    />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    AlertDialogPortal,
    AlertDialogTitle,
    AlertDialogTrigger,
}


=== ./components/ui/card.tsx ===

import * as React from 'react'

import { cn } from '@/lib/utils'

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
            className
        )}
        {...props}
    />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-6', className)}
        {...props}
    />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'text-2xl font-semibold leading-none tracking-tight',
            className
        )}
        {...props}
    />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'text-sm text-neutral-500 dark:text-neutral-400',
            className
        )}
        {...props}
    />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex items-center p-6 pt-0', className)}
        {...props}
    />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }


=== ./components/ui/popover.tsx ===

'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
    React.ElementRef<typeof PopoverPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
    <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
            ref={ref}
            align={align}
            sideOffset={sideOffset}
            className={cn(
                'z-50 w-72 rounded-md border border-neutral-200 bg-white p-4 text-neutral-950 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
                className
            )}
            {...props}
        />
    </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverContent, PopoverTrigger }


=== ./components/ui/hover-card.tsx ===

'use client'

import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import * as React from 'react'

import { cn } from '@/lib/utils'

const HoverCard = HoverCardPrimitive.Root

const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef<
    React.ElementRef<typeof HoverCardPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
    <HoverCardPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
            'z-50 w-64 rounded-md border border-neutral-200 bg-white p-4 text-neutral-950 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
            className
        )}
        {...props}
    />
))
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardContent, HoverCardTrigger }


=== ./components/ui/sheet.tsx ===

'use client'

import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import * as React from 'react'

import { cn } from '@/lib/utils'

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <SheetPrimitive.Overlay
        className={cn(
            'fixed inset-0 z-50 bg-overlay font-bold data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
        )}
        {...props}
        ref={ref}
    />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
    'fixed z-50 gap-4 bg-white dark:bg-darkBg text-text dark:text-darkText p-[9px] transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
    {
        variants: {
            side: {
                top: 'inset-x-0 top-0 border-b-2 border-b-black data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
                bottom: 'inset-x-0 bottom-0 border-t-2 border-t-black data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
                left: 'inset-y-0 left-0 h-full w-full border-r-2 border-r-black data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:w-[694px]',
                right: 'inset-y-0 right-0 h-full w-full border-l-2 border-l-black data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-[694px]',
            },
        },
        defaultVariants: {
            side: 'right',
        },
    }
)

interface SheetContentProps
    extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
        VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Content>,
    SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => (
    <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
            ref={ref}
            className={cn(sheetVariants({ side }), className)}
            {...props}
        >
            {children}
            <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-white">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
        </SheetPrimitive.Content>
    </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col space-y-2 text-center font-bold sm:text-left',
            className
        )}
        {...props}
    />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col-reverse font-bold sm:flex-row sm:justify-end sm:space-x-2',
            className
        )}
        {...props}
    />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
    <SheetPrimitive.Title
        ref={ref}
        className={cn(
            'text-lg font-bold text-text dark:text-darkText',
            className
        )}
        {...props}
    />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
    <SheetPrimitive.Description
        ref={ref}
        className={cn(
            'text-sm font-base text-text dark:text-darkText',
            className
        )}
        {...props}
    />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetOverlay,
    SheetPortal,
    SheetTitle,
    SheetTrigger,
}


=== ./components/ui/scroll-area.tsx ===

'use client'

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'

import * as React from 'react'

import { cn } from '@/lib/utils'

const ScrollArea = React.forwardRef<
    React.ElementRef<typeof ScrollAreaPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
    <ScrollAreaPrimitive.Root
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        {...props}
    >
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
            {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
    React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
    React.ComponentPropsWithoutRef<
        typeof ScrollAreaPrimitive.ScrollAreaScrollbar
    >
>(({ className, orientation = 'vertical', ...props }, ref) => (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
        ref={ref}
        orientation={orientation}
        className={cn(
            'flex touch-none select-none transition-colors',
            orientation === 'vertical' &&
                'h-full w-2.5 border-l border-l-transparent p-[1px]',
            orientation === 'horizontal' &&
                'h-2.5 flex-col border-t border-t-transparent p-[1px]',
            className
        )}
        {...props}
    >
        <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-base bg-black" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }


=== ./components/ui/resizable.tsx ===

'use client'

import * as ResizablePrimitive from 'react-resizable-panels'

import { cn } from '@/lib/utils'

const ResizablePanelGroup = ({
    className,
    ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
    <ResizablePrimitive.PanelGroup
        className={cn(
            'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
            className
        )}
        {...props}
    />
)

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
    withHandle,
    className,
    ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
    withHandle?: boolean
}) => (
    <ResizablePrimitive.PanelResizeHandle
        className={cn(
            'relative flex w-6 items-center justify-center bg-bg after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90 dark:focus-visible:ring-neutral-300',
            className
        )}
        {...props}
    >
        {withHandle && (
            <div className="z-10 flex h-60 w-2.5 items-center justify-center rounded border border-black bg-black dark:border-white dark:bg-white"></div>
        )}
    </ResizablePrimitive.PanelResizeHandle>
)

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }


=== ./components/ui/tooltip.tsx ===

'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
            'z-50 overflow-hidden rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-950 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
            className
        )}
        {...props}
    />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }


=== ./components/ui/alert.tsx ===

import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { AnimatePresence, motion } from 'framer-motion'
import { XCircle } from 'lucide-react'
import * as React from 'react'

const alertVariants = cva(
    'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
    {
        variants: {
            variant: {
                default: 'bg-background text-foreground',
                destructive:
                    'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

const Alert = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
    <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
    />
))
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h5
        ref={ref}
        className={cn(
            'mb-1 font-medium leading-none tracking-tight',
            className
        )}
        {...props}
    />
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('text-sm [&_p]:leading-relaxed', className)}
        {...props}
    />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertDescription, AlertTitle }

interface AlertMessageProps {
    title?: string
    message: string
    variant?: 'default' | 'destructive'
    className?: string
    onDismiss?: () => void
}

export function AlertMessage({
    title,
    message,
    variant = 'default',
    className,
    onDismiss,
}: AlertMessageProps) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
            >
                <Alert
                    variant={variant}
                    className={cn(
                        'border shadow-lg',
                        variant === 'destructive' ? 'bg-red-50' : 'bg-white',
                        'relative cursor-pointer',
                        className
                    )}
                    onClick={onDismiss}
                >
                    {title && <AlertTitle>{title}</AlertTitle>}
                    <div className="flex items-center gap-2">
                        {variant === 'destructive' && (
                            <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <AlertDescription
                            className={cn(
                                'text-sm',
                                variant === 'destructive'
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                            )}
                        >
                            {message}
                        </AlertDescription>
                    </div>
                </Alert>
            </motion.div>
        </AnimatePresence>
    )
}


=== ./components/ui/avatar.tsx ===

import * as AvatarPrimitive from '@radix-ui/react-avatar'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Avatar = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Root
        ref={ref}
        className={cn(
            'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
            className
        )}
        {...props}
    />
))
Avatar.displayName = AvatarPrimitive.Root.displayName
const AvatarImage = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Image>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Image
        ref={ref}
        className={cn('aspect-square h-full w-full', className)}
        {...props}
    />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName
const AvatarFallback = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Fallback>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Fallback
        ref={ref}
        className={cn(
            'flex h-full w-full items-center justify-center rounded-full bg-muted',
            className
        )}
        {...props}
    />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarFallback, AvatarImage }


=== ./components/ui/theme-button-switcher.tsx ===

'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const spring = {
    type: 'spring',
    stiffness: 700,
    damping: 30,
    duration: 0.5,
}

interface ThemeSwitcherButtonProps {
    showLabel?: boolean
}

export const ThemeSwitcherButton = ({
    showLabel = true,
}: ThemeSwitcherButtonProps) => {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleThemeChange = (newTheme: string) => {
        setTheme(newTheme)
    }

    // Prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="flex items-center justify-between gap-4">
                {showLabel && (
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        Theme
                    </span>
                )}
                <div className="relative flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:bg-neutral-800">
                    <div className="h-6 w-[72px]" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-between gap-4">
            {showLabel && (
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Theme
                </span>
            )}
            <div className="relative flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:bg-neutral-800">
                <motion.div
                    className="absolute h-6 w-6 rounded bg-white dark:bg-neutral-700"
                    layout
                    transition={spring}
                    initial={false}
                    animate={{
                        left:
                            theme === 'light'
                                ? '4px'
                                : theme === 'dark'
                                  ? 'calc(33.33% + 2px)'
                                  : 'calc(66.66% + 0px)',
                    }}
                />
                {['light', 'dark', 'system'].map((t) => (
                    <motion.button
                        key={t}
                        layout
                        transition={spring}
                        onClick={() => handleThemeChange(t)}
                        className={cn(
                            'relative z-10 flex h-6 w-6 items-center justify-center rounded'
                        )}
                        aria-label={`Switch to ${t} theme`}
                    >
                        {t === 'light' && (
                            <Sun className="h-4 w-4 text-neutral-900 dark:text-neutral-100" />
                        )}
                        {t === 'dark' && (
                            <Moon className="h-4 w-4 text-neutral-900 dark:text-neutral-100" />
                        )}
                        {t === 'system' && (
                            <Monitor className="h-4 w-4 text-neutral-900 dark:text-neutral-100" />
                        )}
                    </motion.button>
                ))}
            </div>
        </div>
    )
}


=== ./components/ui/dialog.tsx ===

'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
        )}
        {...props}
    />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-neutral-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg dark:border-neutral-800 dark:bg-neutral-950',
                className
            )}
            {...props}
        >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-500 dark:ring-offset-neutral-950 dark:focus:ring-neutral-300 dark:data-[state=open]:bg-neutral-800 dark:data-[state=open]:text-neutral-400">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col space-y-1.5 text-center sm:text-left',
            className
        )}
        {...props}
    />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
            className
        )}
        {...props}
    />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn(
            'text-lg font-semibold leading-none tracking-tight',
            className
        )}
        {...props}
    />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn(
            'text-sm text-neutral-500 dark:text-neutral-400',
            className
        )}
        {...props}
    />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
}


=== ./components/ui/sidebar.tsx ===

'use client'

import { Slot } from '@radix-ui/react-slot'
import { VariantProps, cva } from 'class-variance-authority'
import { PanelLeft } from 'lucide-react'
import * as React from 'react'

import { useIsMobile } from '@/components/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const SIDEBAR_COOKIE_NAME = 'sidebar:state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '4rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

type SidebarContext = {
    state: 'expanded' | 'collapsed'
    open: boolean
    setOpen: (open: boolean) => void
    openMobile: boolean
    setOpenMobile: (open: boolean) => void
    isMobile: boolean
    toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
    const context = React.useContext(SidebarContext)
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider.')
    }

    return context
}

const SidebarProvider = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> & {
        defaultOpen?: boolean
        open?: boolean
        onOpenChange?: (open: boolean) => void
    }
>(
    (
        {
            defaultOpen = true,
            open: openProp,
            onOpenChange: setOpenProp,
            className,
            style,
            children,
            ...props
        },
        ref
    ) => {
        const isMobile = useIsMobile()
        const [openMobile, setOpenMobile] = React.useState(false)

        // This is the internal state of the sidebar.
        // We use openProp and setOpenProp for control from outside the component.
        const [_open, _setOpen] = React.useState(defaultOpen)
        const open = openProp ?? _open
        const setOpen = React.useCallback(
            (value: boolean | ((value: boolean) => boolean)) => {
                if (setOpenProp) {
                    return setOpenProp?.(
                        typeof value === 'function' ? value(open) : value
                    )
                }

                _setOpen(value)

                // This sets the cookie to keep the sidebar state.
                document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
            },
            [setOpenProp, open]
        )

        // Helper to toggle the sidebar.
        const toggleSidebar = React.useCallback(() => {
            return isMobile
                ? setOpenMobile((open) => !open)
                : setOpen((open) => !open)
        }, [isMobile, setOpen, setOpenMobile])

        // Adds a keyboard shortcut to toggle the sidebar.
        React.useEffect(() => {
            const handleKeyDown = (event: KeyboardEvent) => {
                if (
                    event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
                    (event.metaKey || event.ctrlKey)
                ) {
                    event.preventDefault()
                    toggleSidebar()
                }
            }

            window.addEventListener('keydown', handleKeyDown)
            return () => window.removeEventListener('keydown', handleKeyDown)
        }, [toggleSidebar])

        // We add a state so that we can do data-state="expanded" or "collapsed".
        // This makes it easier to style the sidebar with Tailwind classes.
        const state = open ? 'expanded' : 'collapsed'

        const contextValue = React.useMemo<SidebarContext>(
            () => ({
                state,
                open,
                setOpen,
                isMobile,
                openMobile,
                setOpenMobile,
                toggleSidebar,
            }),
            [
                state,
                open,
                setOpen,
                isMobile,
                openMobile,
                setOpenMobile,
                toggleSidebar,
            ]
        )

        return (
            <SidebarContext.Provider value={contextValue}>
                <TooltipProvider delayDuration={0}>
                    <div
                        style={
                            {
                                '--sidebar-width': SIDEBAR_WIDTH,
                                '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
                                ...style,
                            } as React.CSSProperties
                        }
                        className={cn(
                            'group/sidebar-wrapper flex min-h-svh has-[[data-variant=inset]]:bg-sidebar',
                            className
                        )}
                        ref={ref}
                        {...props}
                    >
                        {children}
                    </div>
                </TooltipProvider>
            </SidebarContext.Provider>
        )
    }
)
SidebarProvider.displayName = 'SidebarProvider'

const Sidebar = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> & {
        side?: 'left' | 'right'
        variant?: 'sidebar' | 'floating' | 'inset'
        collapsible?: 'offcanvas' | 'icon' | 'none'
    }
>(
    (
        {
            side = 'left',
            variant = 'sidebar',
            collapsible = 'offcanvas',
            className,
            children,
            ...props
        },
        ref
    ) => {
        const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

        if (collapsible === 'none') {
            return (
                <div
                    className={cn(
                        'flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground',
                        className
                    )}
                    ref={ref}
                    {...props}
                >
                    {children}
                </div>
            )
        }

        if (isMobile) {
            return (
                <Sheet
                    open={openMobile}
                    onOpenChange={setOpenMobile}
                    {...props}
                >
                    <SheetContent
                        data-sidebar="sidebar"
                        data-mobile="true"
                        className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
                        style={
                            {
                                '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
                            } as React.CSSProperties
                        }
                        side={side}
                    >
                        <div className="flex h-full w-full flex-col">
                            {children}
                        </div>
                    </SheetContent>
                </Sheet>
            )
        }

        return (
            <div
                ref={ref}
                className="group peer hidden md:block text-sidebar-foreground"
                data-state={state}
                data-collapsible={state === 'collapsed' ? collapsible : ''}
                data-variant={variant}
                data-side={side}
            >
                {/* This is what handles the sidebar gap on desktop */}
                <div
                    className={cn(
                        'duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear',
                        'group-data-[collapsible=offcanvas]:w-0',
                        'group-data-[side=right]:rotate-180',
                        variant === 'floating' || variant === 'inset'
                            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]'
                            : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon]'
                    )}
                />
                <div
                    className={cn(
                        'duration-200 fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear md:flex',
                        side === 'left'
                            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
                            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
                        // Adjust the padding for floating and inset variants.
                        variant === 'floating' || variant === 'inset'
                            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]'
                            : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l',
                        className
                    )}
                    {...props}
                >
                    <div
                        data-sidebar="sidebar"
                        className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow"
                    >
                        {children}
                    </div>
                </div>
            </div>
        )
    }
)
Sidebar.displayName = 'Sidebar'

const SidebarTrigger = React.forwardRef<
    React.ElementRef<typeof Button>,
    React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()

    return (
        <Button
            ref={ref}
            data-sidebar="trigger"
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', className)}
            onClick={(event) => {
                onClick?.(event)
                toggleSidebar()
            }}
            {...props}
        >
            <PanelLeft />
            <span className="sr-only">Toggle Sidebar</span>
        </Button>
    )
})
SidebarTrigger.displayName = 'SidebarTrigger'

const SidebarRail = React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<'button'>
>(({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()

    return (
        <button
            ref={ref}
            data-sidebar="rail"
            aria-label="Toggle Sidebar"
            tabIndex={-1}
            onClick={toggleSidebar}
            title="Toggle Sidebar"
            className={cn(
                'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] dark:after:bg-sidebar-dark-border dark:hover:after:bg-sidebar-dark-ring hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex',
                '[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize',
                '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
                'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar',
                '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
                '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
                className
            )}
            {...props}
        />
    )
})
SidebarRail.displayName = 'SidebarRail'

const SidebarInset = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'main'>
>(({ className, ...props }, ref) => {
    return (
        <main
            ref={ref}
            className={cn(
                'relative flex min-h-svh flex-1 flex-col bg-white dark:bg-neutral-950',
                'peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow',
                className
            )}
            {...props}
        />
    )
})
SidebarInset.displayName = 'SidebarInset'

const SidebarInput = React.forwardRef<
    React.ElementRef<typeof Input>,
    React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
    return (
        <Input
            ref={ref}
            data-sidebar="input"
            className={cn(
                'h-8 w-full bg-white shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:bg-neutral-950',
                className
            )}
            {...props}
        />
    )
})
SidebarInput.displayName = 'SidebarInput'

const SidebarHeader = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
    return (
        <div
            ref={ref}
            data-sidebar="header"
            className={cn('flex flex-col gap-2 p-2', className)}
            {...props}
        />
    )
})
SidebarHeader.displayName = 'SidebarHeader'

const SidebarFooter = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
    return (
        <div
            ref={ref}
            data-sidebar="footer"
            className={cn('flex flex-col gap-2 p-2', className)}
            {...props}
        />
    )
})
SidebarFooter.displayName = 'SidebarFooter'

const SidebarSeparator = React.forwardRef<
    React.ElementRef<typeof Separator>,
    React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
    return (
        <Separator
            ref={ref}
            data-sidebar="separator"
            className={cn('mx-2 w-auto bg-sidebar-border', className)}
            {...props}
        />
    )
})
SidebarSeparator.displayName = 'SidebarSeparator'

const SidebarContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
    return (
        <div
            ref={ref}
            data-sidebar="content"
            className={cn(
                'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
                className
            )}
            {...props}
        />
    )
})
SidebarContent.displayName = 'SidebarContent'

const SidebarGroup = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
    return (
        <div
            ref={ref}
            data-sidebar="group"
            className={cn(
                'relative flex w-full min-w-0 flex-col p-2',
                className
            )}
            {...props}
        />
    )
})
SidebarGroup.displayName = 'SidebarGroup'

const SidebarGroupLabel = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div'

    return (
        <Comp
            ref={ref}
            data-sidebar="group-label"
            className={cn(
                'duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
                'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
                className
            )}
            {...props}
        />
    )
})
SidebarGroupLabel.displayName = 'SidebarGroupLabel'

const SidebarGroupAction = React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<'button'> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return (
        <Comp
            ref={ref}
            data-sidebar="group-action"
            className={cn(
                'absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
                // Increases the hit area of the button on mobile.
                'after:absolute after:-inset-2 after:md:hidden',
                'group-data-[collapsible=icon]:hidden',
                className
            )}
            {...props}
        />
    )
})
SidebarGroupAction.displayName = 'SidebarGroupAction'

const SidebarGroupContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-sidebar="group-content"
        className={cn('w-full text-sm', className)}
        {...props}
    />
))
SidebarGroupContent.displayName = 'SidebarGroupContent'

const SidebarMenu = React.forwardRef<
    HTMLUListElement,
    React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
    <ul
        ref={ref}
        data-sidebar="menu"
        className={cn('flex w-full min-w-0 flex-col gap-1', className)}
        {...props}
    />
))
SidebarMenu.displayName = 'SidebarMenu'

const SidebarMenuItem = React.forwardRef<
    HTMLLIElement,
    React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
    <li
        ref={ref}
        data-sidebar="menu-item"
        className={cn('group/menu-item relative', className)}
        {...props}
    />
))
SidebarMenuItem.displayName = 'SidebarMenuItem'

const sidebarMenuButtonVariants = cva(
    'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
    {
        variants: {
            variant: {
                default:
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                outline:
                    'bg-white shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))] dark:bg-neutral-950',
            },
            size: {
                default: 'h-8 text-sm',
                sm: 'h-7 text-xs',
                lg: 'h-12 text-sm group-data-[collapsible=icon]:!p-0',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
)

const SidebarMenuButton = React.forwardRef<
    HTMLButtonElement | HTMLDivElement,
    React.ComponentProps<'button'> & {
        asChild?: boolean
        isActive?: boolean
        tooltip?: string | React.ComponentProps<typeof TooltipContent>
    } & VariantProps<typeof sidebarMenuButtonVariants>
>(
    (
        {
            asChild = false,
            isActive = false,
            variant = 'default',
            size = 'default',
            tooltip,
            className,
            children,
            ...props
        },
        ref
    ) => {
        const { isMobile, state } = useSidebar()

        // Check if children contains SidebarTrigger
        const hasTrigger = React.Children.toArray(children).some(
            (child) =>
                React.isValidElement(child) && child.type === SidebarTrigger
        )

        // If we have a SidebarTrigger child, render a div instead of a button
        const Comp = hasTrigger ? 'div' : asChild ? Slot : 'button'

        const button = (
            <Comp
                // @ts-expect-error
                ref={ref}
                data-sidebar="menu-button"
                data-size={size}
                data-active={isActive}
                className={cn(
                    sidebarMenuButtonVariants({ variant, size }),
                    className
                )}
                {...(hasTrigger ? {} : props)} // Only spread props if not a div wrapper
            >
                {children}
            </Comp>
        )

        if (!tooltip) {
            return button
        }

        if (typeof tooltip === 'string') {
            tooltip = {
                children: tooltip,
            }
        }

        return (
            <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent
                    side="right"
                    align="center"
                    hidden={state !== 'collapsed' || isMobile}
                    {...tooltip}
                />
            </Tooltip>
        )
    }
)
SidebarMenuButton.displayName = 'SidebarMenuButton'

const SidebarMenuAction = React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<'button'> & {
        asChild?: boolean
        showOnHover?: boolean
    }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return (
        <Comp
            ref={ref}
            data-sidebar="menu-action"
            className={cn(
                'absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0',
                // Increases the hit area of the button on mobile.
                'after:absolute after:-inset-2 after:md:hidden',
                'peer-data-[size=sm]/menu-button:top-1',
                'peer-data-[size=default]/menu-button:top-1.5',
                'peer-data-[size=lg]/menu-button:top-2.5',
                'group-data-[collapsible=icon]:hidden',
                showOnHover &&
                    'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0',
                className
            )}
            {...props}
        />
    )
})
SidebarMenuAction.displayName = 'SidebarMenuAction'

const SidebarMenuBadge = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-sidebar="menu-badge"
        className={cn(
            'absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none',
            'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
            'peer-data-[size=sm]/menu-button:top-1',
            'peer-data-[size=default]/menu-button:top-1.5',
            'peer-data-[size=lg]/menu-button:top-2.5',
            'group-data-[collapsible=icon]:hidden',
            className
        )}
        {...props}
    />
))
SidebarMenuBadge.displayName = 'SidebarMenuBadge'

const SidebarMenuSkeleton = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> & {
        showIcon?: boolean
    }
>(({ className, showIcon = false, ...props }, ref) => {
    // Random width between 50 to 90%.
    const width = React.useMemo(() => {
        return `${Math.floor(Math.random() * 40) + 50}%`
    }, [])

    return (
        <div
            ref={ref}
            data-sidebar="menu-skeleton"
            className={cn(
                'rounded-md h-8 flex gap-2 px-2 items-center',
                className
            )}
            {...props}
        >
            {showIcon && (
                <Skeleton
                    className="size-4 rounded-md"
                    data-sidebar="menu-skeleton-icon"
                />
            )}
            <Skeleton
                className="h-4 flex-1 max-w-[--skeleton-width]"
                data-sidebar="menu-skeleton-text"
                style={
                    {
                        '--skeleton-width': width,
                    } as React.CSSProperties
                }
            />
        </div>
    )
})
SidebarMenuSkeleton.displayName = 'SidebarMenuSkeleton'

const SidebarMenuSub = React.forwardRef<
    HTMLUListElement,
    React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
    <ul
        ref={ref}
        data-sidebar="menu-sub"
        className={cn(
            'ml-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5',
            'group-data-[collapsible=icon]:hidden',
            className
        )}
        {...props}
    />
))
SidebarMenuSub.displayName = 'SidebarMenuSub'

const SidebarMenuSubItem = React.forwardRef<
    HTMLLIElement,
    React.ComponentProps<'li'>
>(({ ...props }, ref) => <li ref={ref} {...props} />)
SidebarMenuSubItem.displayName = 'SidebarMenuSubItem'

const SidebarMenuSubButton = React.forwardRef<
    HTMLAnchorElement,
    React.ComponentProps<'a'> & {
        asChild?: boolean
        size?: 'sm' | 'md'
        isActive?: boolean
    }
>(({ asChild = false, size = 'md', isActive, className, ...props }, ref) => {
    const Comp = asChild ? Slot : 'a'

    return (
        <Comp
            ref={ref}
            data-sidebar="menu-sub-button"
            data-size={size}
            data-active={isActive}
            className={cn(
                'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
                'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
                size === 'sm' && 'text-xs',
                size === 'md' && 'text-sm',
                'group-data-[collapsible=icon]:hidden',
                className
            )}
            {...props}
        />
    )
})
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton'

export {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
    useSidebar,
}


=== ./components/ui/separator.tsx ===

'use client'

import * as SeparatorPrimitive from '@radix-ui/react-separator'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Separator = React.forwardRef<
    React.ElementRef<typeof SeparatorPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
    (
        { className, orientation = 'horizontal', decorative = true, ...props },
        ref
    ) => (
        <SeparatorPrimitive.Root
            ref={ref}
            decorative={decorative}
            orientation={orientation}
            className={cn(
                'shrink-0 bg-neutral-200 dark:bg-neutral-800',
                orientation === 'horizontal'
                    ? 'h-[1px] w-full'
                    : 'h-full w-[1px]',
                className
            )}
            {...props}
        />
    )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }


=== ./components/ui/button.tsx ===

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 dark:ring-offset-neutral-950 dark:focus-visible:ring-neutral-300',
    {
        variants: {
            variant: {
                default:
                    'bg-neutral-900 text-neutral-50 hover:bg-neutral-900/90 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/90',
                destructive:
                    'bg-red-500 text-neutral-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-neutral-50 dark:hover:bg-red-900/90',
                outline:
                    'border border-neutral-200 bg-white hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
                secondary:
                    'bg-neutral-100 text-neutral-900 hover:bg-neutral-100/80 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-800/80',
                ghost: 'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
                link: 'text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 rounded-md px-3',
                lg: 'h-11 rounded-md px-8',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button'
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'

export { Button, buttonVariants }


=== ./components/ui/collapsible.tsx ===

'use client'

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleContent, CollapsibleTrigger }


=== ./components/ui/dropdown-menu.tsx ===

'use client'

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
        inset?: boolean
    }
>(({ className, inset, children, ...props }, ref) => (
    <DropdownMenuPrimitive.SubTrigger
        ref={ref}
        className={cn(
            'flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-neutral-100 data-[state=open]:bg-neutral-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 dark:focus:bg-neutral-800 dark:data-[state=open]:bg-neutral-800',
            inset && 'pl-8',
            className
        )}
        {...props}
    >
        {children}
        <ChevronRight className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
    DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.SubContent
        ref={ref}
        className={cn(
            'z-50 min-w-[8rem] overflow-hidden rounded-md border border-neutral-200 bg-white p-1 text-neutral-950 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
            className
        )}
        {...props}
    />
))
DropdownMenuSubContent.displayName =
    DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
                'z-50 min-w-[8rem] overflow-hidden rounded-md border border-neutral-200 bg-white p-1 text-neutral-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
                className
            )}
            {...props}
        />
    </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
        inset?: boolean
    }
>(({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
        ref={ref}
        className={cn(
            'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 dark:focus:bg-neutral-800 dark:focus:text-neutral-50',
            inset && 'pl-8',
            className
        )}
        {...props}
    />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
    <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        className={cn(
            'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-neutral-800 dark:focus:text-neutral-50',
            className
        )}
        checked={checked}
        {...props}
    >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <DropdownMenuPrimitive.ItemIndicator>
                <Check className="h-4 w-4" />
            </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
    </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
    DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.RadioItem
        ref={ref}
        className={cn(
            'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-neutral-800 dark:focus:text-neutral-50',
            className
        )}
        {...props}
    >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <DropdownMenuPrimitive.ItemIndicator>
                <Circle className="h-2 w-2 fill-current" />
            </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
    </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Label>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
        inset?: boolean
    }
>(({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Label
        ref={ref}
        className={cn(
            'px-2 py-1.5 text-sm font-semibold',
            inset && 'pl-8',
            className
        )}
        {...props}
    />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Separator
        ref={ref}
        className={cn(
            '-mx-1 my-1 h-px bg-neutral-100 dark:bg-neutral-800',
            className
        )}
        {...props}
    />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
    return (
        <span
            className={cn(
                'ml-auto text-xs tracking-widest opacity-60',
                className
            )}
            {...props}
        />
    )
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
}


=== ./components/ui/textarea.tsx ===

import { cn } from '@/lib/utils'
import * as React from 'react'
import { BorderTrail } from '../core/border-trail'

const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
    return (
        <div className="relative w-full rounded-md border-2 border-neutral-200 dark:border-dark-textAreaBorder">
            <textarea
                className={cn(
                    'flex min-h-[80px] w-full bg-white px-3 py-2 text-base ring-offset-white',
                    'placeholder:text-neutral-500',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'dark:bg-dark-app dark:text-dark-text dark:ring-offset-dark-app',
                    'dark:placeholder:text-neutral-400',
                    'dark:focus-visible:ring-neutral-300',
                    className
                )}
                ref={ref}
                {...props}
            />
            <BorderTrail
                style={{
                    boxShadow:
                        '0px 0px 60px 30px rgb(255 255 255 / 50%), 0 0 100px 60px rgb(0 0 0 / 50%), 0 0 140px 90px rgb(0 0 0 / 50%)',
                }}
                size={100}
            />
        </div>
    )
})
Textarea.displayName = 'Textarea'

export { Textarea }


=== ./components/ui/input.tsx ===

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    'flex h-10 w-full rounded-base border-2 text-text dark:text-darkText font-base selection:bg-main selection:text-black border-border dark:border-darkBorder bg-white dark:bg-darkBg px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = 'Input'

export { Input }


=== ./components/ui/skeleton.tsx ===

import { cn } from '@/lib/utils'

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800',
                className
            )}
            {...props}
        />
    )
}

export { Skeleton }


=== ./components/LoginPage.tsx ===

import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        const data = await response.json()
        if (response.ok) {
            router.push('/')
        } else {
            setError(data.error || 'An error occurred during sign in')
        }
    }

    const handleSignInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })
        if (error) {
            setError(error.message)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-bg dark:bg-darkBg">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl text-black font-bold text-center">
                        login to py_apps
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {error && (
                            <p className="text-red-500 text-sm">{error}</p>
                        )}
                        <Button type="submit" className="w-full">
                            Sign In
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <div className="relative w-full">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border dark:border-darkBorder" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-bg dark:bg-darkBg px-2 text-text dark:text-darkText">
                                Or continue with
                            </span>
                        </div>
                    </div>
                    <Button
                        onClick={handleSignInWithGoogle}
                        variant="default"
                        className="w-full"
                    >
                        Sign in with Google
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}


=== ./components/FilePreview.tsx ===

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { z } from 'zod'
import { ScrollArea } from './ui/scroll-area'

// File validation schema
const FileValidationSchema = z.object({
    file: z
        .instanceof(File)
        .refine(
            (file) => {
                const validExtensions = ['.csv', '.json', '.txt']
                return validExtensions.some((ext) =>
                    file.name.toLowerCase().endsWith(ext)
                )
            },
            {
                message:
                    'Invalid file type. Please upload a CSV, JSON, or TXT file.',
            }
        )
        .refine((file) => file.size <= 100 * 1024 * 1024, {
            message: 'File size must be less than 100MB.',
        }),
})

interface FilePreviewProps {
    file: File
    onRemove: () => void
    onError?: (error: string) => void
    isMinHeight: boolean
    textareaHeight: number
    isSubmitted?: boolean
}

export function FilePreview({
    file,
    onRemove,
    onError,
    isMinHeight,
    textareaHeight,
    isSubmitted = false,
}: FilePreviewProps) {
    const [isVisible, setIsVisible] = useState(true)
    const [preview, setPreview] = useState<string>('')
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const validateAndLoadFile = async () => {
            setIsLoading(true)
            setError(null)

            try {
                // Validate file
                await FileValidationSchema.parseAsync({ file })

                // Read file content
                const text = await readFileContent(file)
                setPreview(text)
            } catch (err) {
                const errorMessage =
                    err instanceof z.ZodError
                        ? err.errors[0].message
                        : 'Error loading file preview'
                setError(errorMessage)
                onError?.(errorMessage)
            } finally {
                setIsLoading(false)
            }
        }

        if (file) {
            validateAndLoadFile()
        }
    }, [file, onError])

    useEffect(() => {
        if (isSubmitted) {
            setIsVisible(false)
        }
    }, [isSubmitted])

    const readFileContent = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()

            reader.onload = (e) => {
                const content = e.target?.result as string

                // Basic content validation
                if (!content.trim()) {
                    reject(new Error('File appears to be empty'))
                    return
                }

                // For CSV files, validate structure with more lenient checks
                if (file.name.toLowerCase().endsWith('.csv')) {
                    const lines = content
                        .split('\n')
                        .filter((line) => line.trim())
                    if (lines.length < 1) {
                        reject(new Error('CSV file appears to be empty'))
                        return
                    }
                }

                // For JSON files, validate JSON structure
                if (file.name.toLowerCase().endsWith('.json')) {
                    try {
                        JSON.parse(content)
                    } catch {
                        reject(new Error('Invalid JSON format'))
                        return
                    }
                }

                resolve(content)
            }

            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsText(file)
        })
    }

    const isPreviewable = (file: File) => {
        const validExtensions = ['.csv', '.txt', '.json']
        return validExtensions.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
        )
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsVisible(false)
        onRemove()
    }

    // Simplified animation logic
    const getPosition = React.useMemo(() => {
        const isBottom = !isMinHeight

        return {
            initial: {
                opacity: 0,
                y: isBottom ? -20 : 20,
            },
            animate: {
                opacity: 1,
                y: 0,
                transition: {
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                    mass: 0.5,
                },
            },
            exit: {
                opacity: 0,
                y: isBottom ? -20 : 20,
                transition: { duration: 0.2 },
            },
        }
    }, [isMinHeight])

    // Debug logging
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[FilePreview] Position Update:', {
                isMinHeight,
                position: isMinHeight ? 'top' : 'bottom',
                height: isMinHeight ? 'min' : 'max',
                animation: getPosition,
                timestamp: new Date().toISOString(),
            })
        }
    }, [isMinHeight, getPosition])

    return (
        <>
            <AnimatePresence mode="wait">
                {isVisible && !isSubmitted && (
                    <motion.div
                        {...getPosition}
                        className={cn(
                            'absolute w-full bg-slate-50 dark:bg-slate-900 border-x',
                            !isMinHeight
                                ? 'top-[130px] translate-y-full border-b rounded-b-xl' // Top position
                                : 'bottom-0 -mb-5 -translate-y-full border-t rounded-t-xl', // Bottom position
                            'transform transition-transform duration-200'
                        )}
                    >
                        <div className="p-2">
                            <motion.div
                                className={`relative bg-white dark:bg-slate-800 rounded-lg border p-3 w-44 cursor-pointer
                                    ${error ? 'border-red-500' : 'hover:border-primary/50'} transition-colors`}
                                onClick={() =>
                                    isPreviewable(file) &&
                                    !error &&
                                    setIsPreviewOpen(true)
                                }
                                whileHover={{ scale: error ? 1 : 1.02 }}
                                whileTap={{ scale: error ? 1 : 0.98 }}
                            >
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleRemove}
                                    className="absolute -right-1.5 -top-1.5 p-1 rounded-full bg-white dark:bg-slate-800 border shadow-sm text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </motion.button>

                                <div className="flex flex-col items-center gap-1.5">
                                    <div className="text-center">
                                        <span className="text-sm dark:text-white font-medium line-clamp-2 text-center">
                                            {file.name}
                                        </span>
                                    </div>

                                    <span className="text-xs text-muted-foreground">
                                        {Math.round(file.size / 1024)}KB
                                    </span>

                                    {error ? (
                                        <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-1 rounded w-full text-center">
                                            {error}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded w-full text-center">
                                            {file.name
                                                .split('.')
                                                .pop()
                                                ?.toUpperCase() || 'FILE'}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl h-[80vh] absolute bottom-0 text-black">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>Preview:</span>
                            <span className="font-normal text-muted-foreground">
                                {file.name}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 h-[calc(80vh-100px)] mt-4 border rounded-md bg-slate-100">
                        <div className="p-4">
                            {isLoading ? (
                                <div className="text-center text-muted-foreground">
                                    Loading preview...
                                </div>
                            ) : error ? (
                                <div className="text-center text-red-500">
                                    {error}
                                </div>
                            ) : (
                                <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                                    {preview}
                                </pre>
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    )
}


=== ./components/core/action-panel.tsx ===

'use client'

import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Code2, Play } from 'lucide-react'
import { useCallback } from 'react'

interface ActionPanelProps {
    isLoading?: boolean
    isLastMessage?: boolean
    onTogglePanel?: () => void
}

export function ActionPanel({
    isLoading,
    isLastMessage,
    onTogglePanel,
}: ActionPanelProps) {
    const handleAction = useCallback(() => {
        if (isLoading) return
        onTogglePanel?.()
    }, [isLoading, onTogglePanel])

    const getStateContent = () => {
        if (!isLoading || !isLastMessage) {
            return {
                icon: Play,
                text: 'App',
                variant: 'default' as const,
            }
        }

        return {
            icon: Code2,
            text: 'Generating code...',
            variant: 'secondary' as const,
        }
    }

    const { icon: Icon, text, variant } = getStateContent()
    const isDisabled = isLoading && isLastMessage

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={text}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="my-4"
            >
                <button
                    onClick={isDisabled ? undefined : handleAction}
                    className={cn(
                        'inline-flex items-center justify-center gap-3',
                        'rounded-none px-4 py-2 text-sm font-medium',
                        'ring-offset-background transition-all duration-200',
                        'focus-visible:outline-none focus-visible:ring-2',
                        'focus-visible:ring-ring focus-visible:ring-offset-2',
                        'border-2 border-black dark:border-white',
                        'hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black',
                        'dark:text-white text-black',
                        'bg-transparent',
                        'hover:-translate-y-[2px] hover:translate-x-[2px]',
                        'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]',
                        'hover:shadow-none',
                        isDisabled && 'pointer-events-none opacity-50'
                    )}
                >
                    {isLoading && isLastMessage ? (
                        <motion.div
                            initial={{ opacity: 1 }}
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                            className="relative"
                        >
                            <Icon className={cn('h-4 w-4', 'text-current')} />
                            <motion.div
                                className="absolute inset-0 dark:bg-white bg-black"
                                initial={{ scaleY: 0 }}
                                animate={{ scaleY: [0, 1, 0] }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                }}
                                style={{ transformOrigin: 'bottom' }}
                            />
                        </motion.div>
                    ) : (
                        <Icon className={cn('h-4 w-4', 'text-current')} />
                    )}
                    <span>{text}</span>
                </button>
            </motion.div>
        </AnimatePresence>
    )
}


=== ./components/core/border-trail.tsx ===

'use client'

import { cn } from '@/lib/utils'
import { motion, type Transition } from 'framer-motion'
import type { CSSProperties } from 'react'

type BorderTrailProps = {
    className?: string
    size?: number
    transition?: Transition
    delay?: number
    onAnimationComplete?: () => void
    style?: CSSProperties
}

export function BorderTrail({
    className,
    size = 60,
    transition,
    delay,
    onAnimationComplete,
    style,
}: BorderTrailProps) {
    const BASE_TRANSITION = {
        repeat: Number.POSITIVE_INFINITY,
        duration: 8,
        ease: 'linear',
    }

    return (
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
            <motion.div
                className={cn(
                    'absolute aspect-square bg-zinc-500 dark:bg-gradient-to-r dark:from-[rgba(59,196,242,0.51)] dark:via-[#F5833F_30%,#7A69F9_60%,#3BC4F2] dark:to-[rgba(242,99,120,0.51)]',
                    className
                )}
                style={{
                    width: size,
                    offsetPath: `rect(0 auto auto 0 round ${size}px)`,
                    ...style,
                }}
                animate={{
                    offsetDistance: ['0%', '100%'],
                }}
                transition={{
                    ...(transition ?? BASE_TRANSITION),
                    delay: delay,
                }}
                onAnimationComplete={onAnimationComplete}
            />
        </div>
    )
}


=== ./components/core/chatbar.tsx ===

'use client'

import { useAutoResizeTextarea } from '@/components/hooks/use-auto-resize-textarea'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ArrowUp, Loader2, PaperclipIcon } from 'lucide-react'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { FileSelector } from '@/components/FileSelector'
import { useAuth } from '@/contexts/AuthContext'

interface ChatbarProps {
    value: string
    onChange: (value: string) => void
    onSubmit: (
        e: React.FormEvent,
        message: string,
        file?: File,
        fileId?: string
    ) => Promise<void>
    isLoading?: boolean
    fileUploadState?: {
        isUploading: boolean
        progress: number
        error: string | null
    }
    isInChatPage?: boolean
    isCentered?: boolean
    chatId?: string
    selectedFileIds?: string[]
    onFileSelect?: (fileIds: string[]) => void
}

const MIN_HEIGHT = 54
const MAX_HEIGHT = 111
const HEIGHT_THRESHOLD = 75

export default function Chatbar({
    value,
    onChange,
    onSubmit,
    isLoading = false,
    fileUploadState,
    isInChatPage = false,
    isCentered = false,
    chatId,
    selectedFileIds = [],
    onFileSelect,
}: ChatbarProps): JSX.Element {
    const { session, showAuthPrompt } = useAuth()
    // Use local state to track file only, not message
    const [file, setFile] = React.useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [isSubmitted, setIsSubmitted] = React.useState(false)
    const [isAnimating, setIsAnimating] = React.useState(false)
    const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: MIN_HEIGHT,
        maxHeight: MAX_HEIGHT,
    })

    // Add debug wrapper function
    const debugLog = (message: string, data: any) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Chatbar] ${message}:`, data)
        }
    }

    // Initialize with MAX_HEIGHT and track previous height
    const [textareaHeight, setTextareaHeight] = React.useState(MAX_HEIGHT)
    const [isTextareaMinHeight, setIsTextareaMinHeight] = React.useState(false)
    const previousHeightRef = React.useRef(MAX_HEIGHT)
    const heightCheckTimeoutRef = React.useRef<NodeJS.Timeout>()

    // Debounced height check
    const checkAndUpdateHeight = React.useCallback(() => {
        if (heightCheckTimeoutRef.current) {
            clearTimeout(heightCheckTimeoutRef.current)
        }

        heightCheckTimeoutRef.current = setTimeout(() => {
            if (textareaRef.current) {
                const currentHeight = textareaRef.current.offsetHeight
                // Check if height is at MIN_HEIGHT
                const isMinHeight = currentHeight === MIN_HEIGHT

                debugLog('Height Values', {
                    currentHeight,
                    MIN_HEIGHT,
                    MAX_HEIGHT,
                    isMinHeight,
                    hasFile: !!file,
                })

                if (file) {
                    setTextareaHeight(MAX_HEIGHT)
                    setIsTextareaMinHeight(isMinHeight) // Use the actual calculation
                    previousHeightRef.current = MAX_HEIGHT
                    return
                }

                setTextareaHeight(currentHeight)
                setIsTextareaMinHeight(isMinHeight)
                previousHeightRef.current = currentHeight
            }
        }, 100)
    }, [file])

    // Cleanup
    React.useEffect(() => {
        return () => {
            if (heightCheckTimeoutRef.current) {
                clearTimeout(heightCheckTimeoutRef.current)
            }
        }
    }, [])

    // Monitor height changes with ResizeObserver
    useEffect(() => {
        if (textareaRef.current) {
            debugLog('Initial Mount', {
                height: textareaRef.current.offsetHeight,
                ref: textareaRef.current,
            })

            // Initial height check
            checkAndUpdateHeight()

            const resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(checkAndUpdateHeight)
            })

            resizeObserver.observe(textareaRef.current)

            return () => {
                if (textareaRef.current) {
                    resizeObserver.unobserve(textareaRef.current)
                }
            }
        }
    }, [checkAndUpdateHeight])

    // Track file changes
    useEffect(() => {
        if (file) {
            debugLog('File Changed', { file })
            // Force a single height check after file change
            setTimeout(checkAndUpdateHeight, 0)
        }
    }, [file, checkAndUpdateHeight])

    const handleRemoveFile = React.useCallback((e?: React.MouseEvent) => {
        e?.preventDefault()
        e?.stopPropagation()
        setFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setIsUploading(true)
            if (fileUploadState) {
                fileUploadState.isUploading = true
                fileUploadState.progress = 0
            }

            try {
                // Step 1: Check for existing file and initialize upload
                const initResponse = await fetch('/api/files', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fileName: selectedFile.name,
                        fileType: selectedFile.name.split('.').pop() || 'txt',
                        fileSize: selectedFile.size,
                        chatId: chatId,
                        overwrite: true // Signal that we want to overwrite
                    }),
                })

                if (!initResponse.ok) throw new Error('Failed to initialize upload')
                const { uploadId, key, fileId, existingFileId } = await initResponse.json()

                // Step 2: Upload file in chunks
                const CHUNK_SIZE = 4 * 1024 * 1024 // 5MB chunks
                const chunks = Math.ceil(selectedFile.size / CHUNK_SIZE)
                const parts = []

                for (let partNumber = 1; partNumber <= chunks; partNumber++) {
                    const start = (partNumber - 1) * CHUNK_SIZE
                    const end = Math.min(start + CHUNK_SIZE, selectedFile.size)
                    const chunk = selectedFile.slice(start, end)

                    const formData = new FormData()
                    formData.append('uploadId', uploadId)
                    formData.append('partNumber', partNumber.toString())
                    formData.append('key', key)
                    formData.append('file', chunk)

                    const partResponse = await fetch('/api/files', {
                        method: 'POST',
                        body: formData,
                    })

                    if (!partResponse.ok) throw new Error('Failed to upload part')
                    const { ETag } = await partResponse.json()
                    parts.push({ PartNumber: partNumber, ETag })

                    // Update progress
                    const progress = (partNumber / chunks) * 100
                    if (fileUploadState) {
                        fileUploadState.progress = progress
                        fileUploadState.isUploading = true
                    }
                    onChange(`Uploading ${selectedFile.name} (${Math.round(progress)}%)`)
                }

                // Show metadata generation message
                if (fileUploadState) {
                    fileUploadState.progress = 100
                }
                onChange('Generating file metadata...')

                // Step 3: Complete upload
                const completeResponse = await fetch('/api/files', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        uploadId,
                        key,
                        parts,
                        fileId,
                        existingFileId
                    }),
                })

                if (!completeResponse.ok) throw new Error('Failed to complete upload')
                setUploadedFileId(fileId)
                // Clear the upload message and state
                onChange('')
                if (fileUploadState) {
                    fileUploadState.isUploading = false
                    fileUploadState.progress = 0
                }
                setIsUploading(false)

                // Update file selection - replace old file ID with new one if it existed
                if (onFileSelect) {
                    const newFileIds = [...selectedFileIds]
                    if (existingFileId) {
                        const index = newFileIds.indexOf(existingFileId)
                        if (index !== -1) {
                            newFileIds[index] = fileId
                        } else {
                            newFileIds.push(fileId)
                        }
                    } else {
                        newFileIds.push(fileId)
                    }
                    onFileSelect(newFileIds)
                }

                // Update chat associations if needed
                if (chatId) {
                    await fetch(`/api/chats/${chatId}/files`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            oldFileId: existingFileId,
                            newFileId: fileId
                        }),
                    })
                }

                // Automatically trigger file upload completion
                await onSubmit(new Event('submit') as any, '', selectedFile, fileId)
                handleRemoveFile()
                setUploadedFileId(null)

                if (textareaRef.current) {
                    const currentHeight = textareaRef.current.offsetHeight
                    textareaRef.current.style.height = `${MAX_HEIGHT}px`
                    setTextareaHeight(MAX_HEIGHT)
                    setIsTextareaMinHeight(currentHeight === MIN_HEIGHT)
                    previousHeightRef.current = MAX_HEIGHT
                }
            } catch (error) {
                console.error('Upload failed:', error)
                handleRemoveFile()
                onChange('')
                if (handleFileError) {
                    handleFileError('Failed to upload file. Please try again.')
                }
                if (fileUploadState) {
                    fileUploadState.error = 'Upload failed'
                }
            } finally {
                setIsUploading(false)
                if (fileUploadState) {
                    fileUploadState.isUploading = false
                    fileUploadState.progress = 0
                }
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isLoading || isUploading) return

        setIsSubmitted(true)
        setIsAnimating(true)

        try {
            if (file && uploadedFileId) {
                // File submission
                await onSubmit(e, '', file, uploadedFileId)
                handleRemoveFile()
                setUploadedFileId(null)
                // Clear upload state
                if (fileUploadState) {
                    fileUploadState.isUploading = false
                    fileUploadState.progress = 0
                }
                setIsUploading(false)
            } else if (value.trim()) {
                // Normal message submission
                await onSubmit(e, value)
            }
            adjustHeight(true)
        } catch (error) {
            console.error('Failed to send message:', error)
        } finally {
            setIsSubmitted(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!isLoading && (value.trim() || file)) {
                handleSubmit(e as any)
            }
        }
    }

    const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value)
        adjustHeight()

        // Defer height check to next frame to ensure DOM updates
        requestAnimationFrame(() => {
            checkAndUpdateHeight()
            debugLog('Message Changed', {
                value: e.target.value,
                height: textareaRef.current?.offsetHeight,
            })
        })
    }

    // Add handleFileError function
    const handleFileError = React.useCallback((error: string) => {
        if (process.env.NODE_ENV === 'development') {
            console.error('[Chatbar] File Error:', error)
        }
        // You can add additional error handling here if needed
        // For example, showing a toast notification
    }, [])

    // Load initial selected files
    useEffect(() => {
        const loadSelectedFiles = async () => {
            if (!chatId) return
            try {
                const response = await fetch(`/api/chats/${chatId}/files`)
                if (!response.ok) throw new Error('Failed to fetch files')
                const files = await response.json()
                onFileSelect?.(files.map((f: any) => f.id))
            } catch (error) {
                console.error('Error loading selected files:', error)
            }
        }

        if (chatId) {
            loadSelectedFiles()
        }
    }, [chatId, onFileSelect])

    const handleFileSelect = async (fileIds: string[]) => {
        onFileSelect?.(fileIds)
    }

    const handlePaperclipClick = () => {
        if (!session) {
            showAuthPrompt()
            return
        }
        fileInputRef.current?.click()
    }

    return (
        <motion.div
            className="p-4 w-full absolute bg-background dark:bg-dark-app"
            style={{
                bottom: isInChatPage ? 0 : '40vh',
            }}
            animate={{
                bottom: isInChatPage ? 0 : isSubmitted ? 0 : '40vh',
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
            <form
                onSubmit={handleSubmit}
                className="flex relative flex-col gap-4 max-w-[800px] mx-auto"
            >
                <div className="relative flex items-center">
                    {isUploading && (
                        <div className="absolute inset-x-0 -top-1">
                            <div className="relative h-1 bg-gray-100 dark:bg-gray-800 rounded-t-lg overflow-hidden">
                                <div 
                                    className="absolute inset-y-0 left-0 bg-green-400 dark:bg-green-500 transition-all duration-300 ease-out"
                                    style={{ width: `${fileUploadState?.progress || 0}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <Textarea
                        value={value}
                        ref={textareaRef}
                        onChange={handleMessageChange}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            isUploading
                                ? `Uploading ${file?.name || 'file'} (${Math.round(fileUploadState?.progress || 0)}%)`
                                : file && uploadedFileId
                                    ? 'Press Enter to start project with file!'
                                    : 'Type your message...'
                        }
                        className={cn(
                            'w-full resize-none rounded-lg pr-24 py-4',
                            'focus-visible:ring-1 focus-visible:ring-offset-0',
                            'scrollbar-thumb-rounded scrollbar-track-rounded',
                            'scrollbar-thin scrollbar-thumb-border',
                            'dark:bg-dark-app dark:text-dark-text dark:border-dark-border',
                            'transition-opacity duration-200',
                            isUploading && 'opacity-90'
                        )}
                        style={{
                            minHeight: isInChatPage
                                ? '54px'
                                : isAnimating
                                  ? '54px'
                                  : `${MIN_HEIGHT}px`,
                            maxHeight: isInChatPage
                                ? '54px'
                                : isAnimating
                                  ? '54px'
                                  : `${MAX_HEIGHT}px`,
                            height: `${textareaHeight}px`,
                            transition: 'all 0.3s ease-in-out',
                        }}
                        disabled={isLoading || isUploading || !!file}
                        onFocus={() => checkAndUpdateHeight()}
                        onBlur={() => checkAndUpdateHeight()}
                    />

                    <div className="absolute bottom-2 right-2">
                        <Button
                            type="submit"
                            size="icon"
                            className={cn(
                                'h-9 w-9',
                                'bg-gradient-to-tr from-[#FFDE56] to-[#4989BB]',
                                'dark:from-[#03f241] dark:via-[#d549dd] dark:to-[#03e5f2]',
                                'disabled:bg-none disabled:bg-[#F5F5F5] disabled:border disabled:border-[#D4D4D4]',
                                'dark:disabled:bg-dark-app dark:disabled:border-dark-border'
                            )}
                            disabled={
                                isLoading ||
                                isUploading ||
                                (!value.trim() && !file) ||
                                (!!file && !uploadedFileId)
                            }
                        >
                            {isLoading || isUploading ? (
                                <Loader2
                                    className={cn(
                                        'h-5 w-5 animate-spin text-black dark:text-dark-text',
                                        isCentered && 'h-6 w-6'
                                    )}
                                />
                            ) : (
                                <ArrowUp
                                    className={cn(
                                        'h-5 w-5',
                                        'text-black dark:text-dark-text',
                                        'disabled:text-[#D4D4D4] dark:disabled:text-dark-border'
                                    )}
                                />
                            )}
                        </Button>
                    </div>

                    <div className={cn(
                        "absolute bottom-2",
                        isInChatPage ? "right-14" : "left-4"
                    )}>
                        <motion.div
                            className="flex gap-2"
                            initial={false}
                            animate={{
                                x: (!isInChatPage && isAnimating) ? 'calc(100vw - 200px)' : 0
                            }}
                            transition={{
                                duration: 0.3,
                                ease: 'easeInOut',
                            }}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                                accept=".csv"
                            />

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 bg-secondary dark:bg-dark-app dark:text-dark-text dark:hover:bg-dark-border"
                                onClick={handlePaperclipClick}
                                disabled={isLoading || isUploading}
                            >
                                <PaperclipIcon
                                    className={cn(
                                        'h-5 w-5',
                                        isCentered && 'h-6 w-6'
                                    )}
                                />
                            </Button>

                            <FileSelector
                                onFileSelect={handleFileSelect}
                                selectedFileIds={selectedFileIds}
                                chatId={chatId}
                            />
                        </motion.div>
                    </div>
                </div>
            </form>
        </motion.div>
    )
}


=== ./components/core/markdown.tsx ===

'use client'

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import { BundledLanguage, createHighlighter } from 'shiki'

// Base styles that don't change with theme
const markdownStyles = `
    [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:space-y-2
    [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:space-y-2
    [&_li>ul]:list-disc [&_li>ul]:ml-6 [&_li>ul]:mt-2 [&_li>ul]:space-y-2
    [&_li>ol]:list-decimal [&_li>ol]:ml-6 [&_li>ol]:mt-2 [&_li>ol]:space-y-2
    [&_li]:pl-2

    [&]:w-full [&]:max-w-full [&]:overflow-hidden
    
    [&_pre]:relative [&_pre]:my-2 [&_pre]:rounded-lg
    [&_pre]:bg-transparent
    [&_pre]:border dark:[&_pre]:border-neutral-800
    [&_pre]:w-full [&_pre]:overflow-x-auto
    
    [&_.shiki]:!bg-transparent [&_.shiki]:w-full
    [&_.shiki-container]:w-full [&_.shiki-container]:px-4 [&_.shiki-container]:py-3
    [&_.shiki-container]:overflow-x-auto [&_.shiki-container]:bg-white dark:[&_.shiki-container]:bg-transparent
    [&_.shiki-container]:min-w-0 [&_.shiki-container]:max-w-full [&_.shiki-container]:rounded-lg
    [&_.shiki-container]:text-black dark:[&_.shiki-container]:text-neutral-100

    [&_code:not(pre code)]:bg-neutral-200 dark:[&_code:not(pre code)]:bg-transparent
    [&_code:not(pre code)]:text-neutral-800 dark:[&_code:not(pre code)]:text-neutral-200
    [&_code:not(pre code)]:rounded [&_code:not(pre code)]:px-1.5 [&_code:not(pre code)]:py-0.5
    [&_code:not(pre code)]:border dark:[&_code:not(pre code)]:border-neutral-600

    [&_a]:text-blue-500 [&_a]:underline hover:[&_a]:text-blue-400
    [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-700 [&_blockquote]:pl-4 [&_blockquote]:italic
    [&_table]:border-collapse [&_table]:w-full
    [&_th]:border [&_th]:border-neutral-800 [&_th]:p-2 [&_th]:bg-neutral-900
    [&_td]:border [&_td]:border-neutral-800 [&_td]:p-2
`

export const assistantMarkdownStyles = `
    ${markdownStyles}
    [&_p]:my-2
    space-y-4
`

export const userMarkdownStyles = `
    ${markdownStyles}
    [&_p]:my-0
    [&>*:first-child]:mt-0
    [&>*:last-child]:mb-0
    space-y-2
`

const CODE_THEMES = {
    dark: {
        primary: 'github-dark-high-contrast',
    },
    light: {
        primary: 'github-light',
    },
} as const

let highlighterPromise: Promise<any> | null = null

async function initHighlighter() {
    if (!highlighterPromise) {
        const allThemes = [
            ...Object.values(CODE_THEMES.dark),
            ...Object.values(CODE_THEMES.light),
        ]

        highlighterPromise = createHighlighter({
            themes: allThemes,
            langs: [
                'python', 'typescript', 'javascript', 'jsx', 'tsx', 
                'json', 'bash', 'shell', 'markdown', 'yaml', 
                'dockerfile', 'html', 'css', 'sql'
            ],
        })
    }
    return highlighterPromise
}

async function highlightCode(code: string, lang: string) {
    const highlighter = await initHighlighter()
    try {
        const html = highlighter.codeToHtml(code.trim(), {
            lang: lang as BundledLanguage || 'text',
            themes: {
                light: CODE_THEMES.light.primary,
                dark: CODE_THEMES.dark.primary,
            },
        })

        return html
    } catch (e) {
        console.error('Highlighting error:', e)
        return `<pre><code>${code}</code></pre>`
    }
}

async function processCodeBlocks(content: string) {
    if (!content) return ''
    
    const codeBlockRegex = /```([\w]*)\n([\s\S]*?)```/g
    let processedContent = content
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
        const [block, lang, code] = match
        const highlighted = await highlightCode(code, lang || 'text')
        processedContent = processedContent.replace(block, `<div class="shiki-container">${highlighted}</div>`)
    }

    return processedContent
}

export async function markdownToHtml(content: string) {
    if (!content) return ''

    try {
        const processedContent = await processCodeBlocks(content)
        const file = await unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkRehype, { allowDangerousHtml: true })
            .use(rehypeRaw)
            .use(rehypeStringify)
            .process(processedContent)
        
        return String(file)
    } catch (error) {
        console.error('Error processing markdown:', error)
        return content
    }
}

=== ./components/core/Logo.tsx ===

'use client'

import { cn } from '@/lib/utils'

interface LogoProps {
    collapsed?: boolean
    inverted?: boolean
    className?: string
}

export function Logo({
    collapsed = false,
    inverted = false,
    className,
}: LogoProps) {
    return (
        <div
            className={cn(
                'relative font-mono font-bold tracking-tighter',
                className
            )}
        >
            <style jsx>{`
                @keyframes blink {
                    0%,
                    100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0;
                    }
                }
                .cursor {
                    animation: blink 1s step-end infinite;
                    margin-left: -0.1em;
                }
                .app {
                    margin-left: 0.3em;
                    transition: opacity 0.2s ease;
                }
            `}</style>
            <span
                className={cn(
                    'text-2xl',
                    inverted
                        ? 'text-black dark:text-white'
                        : 'text-white dark:text-black'
                )}
            >
                py_
            </span>
            <span
                className={cn(
                    'cursor absolute text-2xl',
                    inverted
                        ? 'text-black dark:text-white'
                        : 'text-white dark:text-black'
                )}
            >
                |
            </span>
            {!collapsed && (
                <span className="app text-gray-400 font-normal text-2xl">
                    apps
                </span>
            )}
        </div>
    )
}


=== ./components/core/message.tsx ===

'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { App, ExecutionResult } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { ActionPanel } from './action-panel'
import { assistantMarkdownStyles, userMarkdownStyles, markdownToHtml } from './markdown'
import { Logo } from '@/components/core/Logo'

interface ActionButton {
    label: string
    value: string
    [key: string]: string
}

interface MessageContent {
    text?: string
    type?: string
    args?: any
    toolName?: string
    toolCallId?: string
    result?: any
}

interface MessageProps {
    id: string
    role: 'system' | 'user' | 'assistant' | 'tool' | 'data'
    content: string | MessageContent[] | any
    isLastMessage?: boolean
    showAvatar?: boolean
    isLoading?: boolean
    object?: App
    result?: ExecutionResult
    onObjectClick?: (preview: {
        object: App | undefined
        result: ExecutionResult | undefined
    }) => void
    onToolResultClick?: (result: string) => void
    onCodeClick?: (messageId: string) => void
    isCreatingChat?: boolean
    onTogglePanel?: () => void
    data?: {
        type: string
        actions?: ActionButton[]
    }
    onInputChange?: (value: string) => void
    toolInvocations?: any[]
}

export function Message({
    role,
    content,
    id,
    isLastMessage = false,
    toolInvocations,
    isLoading,
    isCreatingChat = false,
    onTogglePanel,
    data,
    onInputChange,
    showAvatar = true,
}: MessageProps) {
    // Skip rendering for tool messages
    if (role === 'tool') return null;
    
    const isUser = role === 'user'
    const { session } = useAuth()
    const user = session?.user
    const messageEndRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    
    useEffect(() => {
        const renderMarkdown = async () => {
            if (!contentRef.current) return
            
            let textContent = ''
            if (typeof content === 'string') {
                textContent = content
            } else if (Array.isArray(content)) {
                // Extract text content from array of content objects
                textContent = content
                    .filter(item => item.type === 'text')
                    .map(item => item.text)
                    .join('\n\n')
            }
            
            if (!textContent) return
            
            try {
                const html = await markdownToHtml(textContent)
                if (contentRef.current) {
                    contentRef.current.innerHTML = html
                }
            } catch (error) {
                console.error('Error rendering markdown:', error)
            }
        }
        renderMarkdown()
    }, [content])

    useEffect(() => {
        if (isLastMessage && messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [isLastMessage, content])

    // Extract tool calls from content if it's an array
    const extractedToolCalls = Array.isArray(content) 
        ? content.filter(item => item.type === 'tool-call').map(item => ({
            toolName: item.toolName,
            toolCallId: item.toolCallId,
            args: item.args
        }))
        : undefined

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={id}
                initial={isCreatingChat ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={isCreatingChat ? { opacity: 0 } : undefined}
                transition={{ duration: 0.2 }}
                className={cn(
                    'flex w-full',
                    isUser ? 'justify-end' : 'justify-start',
                    'mb-0'
                )}
            >
                {!isUser ? (
                    <div className="flex flex-row items-start w-full overflow-hidden">
                        <div className={cn(
                            "w-8 h-8 mt-5 flex-shrink-0 flex items-center justify-center",
                            !showAvatar && "opacity-0"
                        )}>
                            <Logo collapsed inverted className="scale-75" />
                        </div>
                        <div className={cn(
                            "mx-2 break-words w-full dark:text-dark-text overflow-hidden",
                            showAvatar ? "p-4" : "p-1",
                            showAvatar ? "mt-0" : "-mt-2"
                        )}>
                            <div 
                                ref={contentRef}
                                className={cn("max-w-[calc(100%-2rem)] overflow-x-auto", assistantMarkdownStyles)}
                            />

                            {data?.type === 'action_buttons' && data.actions && (
                                <motion.div 
                                    className="flex flex-wrap gap-2 mt-4"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {data.actions.map((action, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                if (onInputChange) {
                                                    onInputChange(action.value)
                                                }
                                            }}
                                            className={cn(
                                                "px-4 py-2 text-sm font-medium",
                                                "bg-black dark:bg-dark-background",
                                                "text-white",
                                                "border-2 border-black dark:border-white",
                                                "shadow-[2px_2px_0px_0px_rgba(0,0,0)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255)]",
                                                "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
                                                "transition-all"
                                            )}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}

                            {(Boolean(toolInvocations?.length) || Boolean(extractedToolCalls?.length)) && (
                                <ActionPanel
                                    isLoading={isLoading}
                                    isLastMessage={isLastMessage}
                                    onTogglePanel={onTogglePanel}
                                />
                            )}

                            {isLastMessage && isLoading && !toolInvocations?.length && !extractedToolCalls?.length && (
                                <motion.div
                                    className="w-2 h-4 bg-black/40 dark:bg-white/40 mt-1"
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        ease: 'linear',
                                    }}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-row items-start gap-2 max-w-[85%] mb-4">
                        <div className="grow-0 mx-2 py-2 px-3 rounded-lg bg-background border border-border text-foreground overflow-auto">
                            <div 
                                ref={contentRef}
                                className={userMarkdownStyles}
                            />
                        </div>
                        <Avatar className="w-8 h-8 bg-blue-500 border-2 border-border flex-shrink-0 mt-1">
                            {user?.user_metadata?.avatar_url ? (
                                <AvatarImage
                                    src={user.user_metadata.avatar_url}
                                    alt={user.user_metadata.full_name || 'User'}
                                />
                            ) : (
                                <AvatarFallback>
                                    {user?.user_metadata?.full_name?.[0]?.toUpperCase() ||
                                        user?.email?.[0]?.toUpperCase() ||
                                        'U'}
                                </AvatarFallback>
                            )}
                        </Avatar>
                    </div>
                )}
                <div ref={messageEndRef} />
            </motion.div>
        </AnimatePresence>
    )
}

export default Message

=== ./components/core/typing-text.tsx ===

'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface TypingTextProps {
    text: string
    speed?: number
    className?: string
    show: boolean
}

export function TypingText({
    text,
    speed = 30,
    className,
    show,
}: TypingTextProps) {
    const [displayText, setDisplayText] = useState('')
    const [isTyping, setIsTyping] = useState(true)

    useEffect(() => {
        let currentIndex = 0

        const typeText = () => {
            if (currentIndex < text.length) {
                setDisplayText(text.slice(0, currentIndex + 1))
                currentIndex++
                setTimeout(typeText, speed)
            } else {
                setIsTyping(false)
            }
        }

        if (show) {
            typeText()
        }

        return () => {
            setDisplayText('')
            setIsTyping(true)
        }
    }, [text, speed, show])

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute inset-0 flex items-center w-full justify-center pb-96 z-50 pointer-events-none"
                >
                    <p className={`${className} flex items-center`}>
                        <span className="animate-fade-in">{displayText}</span>
                        {isTyping && (
                            <span
                                className="ml-[2px] w-[2px] h-[1.2em] bg-current animate-cursor-blink"
                                style={{
                                    display: 'inline-block',
                                    verticalAlign: 'middle',
                                }}
                            />
                        )}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    )
}


=== ./components/StreamlitFrame.tsx ===

'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'

export interface StreamlitFrameRef {
    refreshIframe: () => void
}

interface StreamlitFrameProps {
    url: string
}

const StreamlitFrame = forwardRef<StreamlitFrameRef, StreamlitFrameProps>(
    function StreamlitFrame({ url }, ref) {
        const iframeRef = useRef<HTMLIFrameElement>(null)
        const [isLoading, setIsLoading] = useState(true)
        const [isInitialLoad, setIsInitialLoad] = useState(true)

        const refreshIframe = () => {
            if (iframeRef.current) {
                setIsLoading(true)
                iframeRef.current.src = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
            }
        }

        useImperativeHandle(
            ref,
            () => ({
                refreshIframe,
            }),
            [url]
        )

        useEffect(() => {
            const timer = setTimeout(() => {
                refreshIframe()
                setIsInitialLoad(false)
            }, 3000)

            return () => clearTimeout(timer)
        }, [url])

        const handleIframeLoad = () => {
            if (!isInitialLoad) {
                setIsLoading(false)
            }
        }

        return (
            <div className="relative w-full h-[calc(100vh-3.5rem)]">
                <iframe
                    ref={iframeRef}
                    id="streamlit-iframe"
                    src={url}
                    className={cn(
                        'w-full h-full border-0',
                        (isLoading || isInitialLoad) &&
                            'blur-sm transition-all duration-200'
                    )}
                    allow="camera"
                    onLoad={handleIframeLoad}
                />
                {(isLoading || isInitialLoad) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-dark-app/50 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    </div>
                )}
            </div>
        )
    }
)

StreamlitFrame.displayName = 'StreamlitFrame'

export { StreamlitFrame }


=== ./components/LoadingAnimation.tsx ===

'use client'

import { motion } from 'framer-motion'
import './rubrik-cube/rubrik.css'

interface LoadingAnimationProps {
    message: string
}

export default function LoadingAnimation({ message }: LoadingAnimationProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10"
        >
            <motion.div
                className="flex flex-col items-center gap-6 loading-container"
                initial={{ scale: 0.5, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', duration: 0.6 }}
            >
                <div className="container" style={{ transform: 'scale(0.5)' }}>
                    <div className="rubiks-cube rubiks-cube-1">
                        {Array.from({ length: 27 }, (_, i) => (
                            <div key={i} className="detail">
                                <div className="side front" />
                                <div className="side back" />
                                <div className="side top" />
                                <div className="side bottom" />
                                <div className="side left" />
                                <div className="side right" />
                            </div>
                        ))}
                    </div>
                    <div className="reflection">
                        <div className="rubiks-cube rubiks-cube-1">
                            {Array.from({ length: 27 }, (_, i) => (
                                <div key={i} className="detail">
                                    <div className="side front" />
                                    <div className="side back" />
                                    <div className="side top" />
                                    <div className="side bottom" />
                                    <div className="side left" />
                                    <div className="side right" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <motion.p
                    className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400 dark:from-cyan-300 dark:to-indigo-300"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                        delay: 0.3,
                        duration: 0.5,
                        ease: "easeOut"
                    }}
                >
                    {message}
                </motion.p>
            </motion.div>
        </motion.div>
    )
}


=== ./components/ChatContainer.tsx ===

'use client'

import Chat from '@/components/Chat'
import { PreviewPanel } from '@/components/PreviewPanel'
import { AuthPrompt } from '@/components/ui/auth-prompt'
import { Button } from '@/components/ui/button'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import modelsList from '@/lib/models.json'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { AppVersion, LLMModelConfig } from '@/lib/types'
import { cn, formatDatabaseMessages } from '@/lib/utils'
import { useChat } from 'ai/react'
import { JSONValue } from 'ai'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { VersionSelector } from '../components/VersionSelector'
import { TypingText } from './core/typing-text'
import LoadingAnimation from './LoadingAnimation'
import AppSidebar from './Sidebar'

interface ChatContainerProps {
    initialChat?: any
    initialMessages?: any[]
    initialVersion?: AppVersion | AppVersion[] | null
    initialFiles?: Array<{
        id: string
        file_name: string
        file_type: string
        analysis: string | null
        created_at: string
    }>
    isNewChat?: boolean
    isInChatPage?: boolean
    initialAppId?: string | null
    onChatDeleted?: () => void
    onChatFinish?: () => void
}

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

interface StreamlitToolCall {
    toolCallId: string
    toolName: 'streamlitTool'
    args: {
        code: string
        requiredLibraries: string[]
        appName: string
        appDescription: string
    }
}

interface RightPanelState {
    isVisible: boolean
    view: 'code' | 'preview'
}

interface ChatState {
    status: 'initial' | 'typing' | 'creating' | 'active'
    hasMessages: boolean
}

export default function ChatContainer({
    initialMessages = [],
    initialVersion = null,
    isNewChat = false,
    isInChatPage = false,
    initialAppId = null,
}: ChatContainerProps) {
    const router = useRouter()
    const { session, isLoading, shouldShowAuthPrompt } =
        useAuth()
    const { collapsed: sidebarCollapsed } = useSidebar()
    const {
        streamlitUrl,
        generatedCode,
        updateSandbox,
        killSandbox,
        setGeneratingCode,
        isGeneratingCode,
        isLoadingSandbox,
        setStreamlitUrl,
        setGeneratedCode,
        setIsLoadingSandbox,
    } = useSandboxStore()

    // Refs for preventing race conditions
    const abortControllerRef = useRef<AbortController | null>(null)
    const pendingFileLinkId = useRef<string | null>(null)
    const newChatIdRef = useRef<string | null>(null)
    const hasNavigated = useRef(false)
    const isVersionSwitching = useRef(false)
    const versionSelectorRef = useRef<{ refreshVersions: () => void } | null>(
        null
    )
    const resizableGroupRef = useRef<any>(null)
    const isExecutingRef = useRef(false)
    const hasInitialized = useRef(false)
    const streamlitPreviewRef = useRef<{ refreshIframe: () => void } | null>(
        null
    )
    const titleGeneratedRef = useRef<Set<string>>(new Set())

    // State management
    const [sidebarChats, setSidebarChats] = useState<any[]>([])
    const [currentChatId, setCurrentChatId] = useState<string | undefined>(
        undefined
    )
    const [rightPanel, setRightPanel] = useState<RightPanelState>({
        isVisible: false,
        view: 'preview',
    })
    const [chatState, setChatState] = useState<ChatState>({
        status: 'initial',
        hasMessages: initialMessages?.length > 0,
    })
    const [sandboxId, setSandboxId] = useState<string | null>(null)
    const [errorState, setErrorState] = useState<Error | null>(null)
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        isUploading: false,
        progress: 0,
        error: null,
    })
    const [hasFirstMessage, setHasFirstMessage] = useState(false)
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const [currentAppId, setCurrentAppId] = useState<string | null>(
        initialAppId || null
    )
    const [chatTitles, setChatTitles] = useState<Record<string, string>>({})
    const [persistedFileIds, setPersistedFileIds] = useState<string[]>([])

    // Model configuration
    const [languageModel] = useLocalStorage<LLMModelConfig>('languageModel', {
        model: 'claude-3-5-sonnet-20241022',
    })
    const currentModel = modelsList.models.find(
        (model) => model.id === languageModel.model
    )

    // Add a new state for remount keys
    const [previewKey, setPreviewKey] = useState<number>(0)
    const [versionKey, setVersionKey] = useState<number>(0)

    // Add this state to track navigation
    const [isNavigating, setIsNavigating] = useState(false)

    // Move updateChatState before handleChatCreated
    const updateChatState = useCallback((updates: Partial<ChatState>) => {
        setChatState((prev) => ({ ...prev, ...updates }))
    }, [])

    const {
        messages,
        isLoading: chatLoading,
        input,
        handleInputChange: originalHandleInputChange,
        handleSubmit: originalHandleSubmit,
        append,
        setMessages,
    } = useChat({
        api: '/api/chats/stream',
        id: currentChatId || undefined,
        initialMessages: initialMessages || [],
        body: {
            chatId: currentChatId,
            model: currentModel,
            config: languageModel,
            experimental_streamData: true,
            fileIds: persistedFileIds
        },
        onResponse: async (response) => {
            const newChatId = response.headers.get('x-chat-id')
            const newAppId = response.headers.get('x-app-id')
            if (newChatId && !currentChatId) {
                newChatIdRef.current = newChatId
            }
            if (newAppId && !currentAppId) {
                setCurrentAppId(newAppId)
            }

            if (pendingFileLinkId.current && newChatId) {
                try {
                    await fetch('/api/chats/files', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: newChatId,
                            fileId: pendingFileLinkId.current,
                        }),
                    })
                    pendingFileLinkId.current = null
                } catch (error) {
                    console.error('Failed to link file:', error)
                    setErrorState(error as Error)
                }
            }
        },
        onToolCall: async ({ toolCall }) => {
            console.log('🔧 onToolCall:', toolCall)

            const streamlitToolCall = toolCall as StreamlitToolCall
            if (streamlitToolCall.toolName === 'streamlitTool' && streamlitToolCall.args?.code) {
                React.startTransition(() => {
                    setRightPanel((prev) => ({
                        ...prev,
                        isVisible: true,
                    }))
                    setGeneratingCode(true)
                })
                
                // Update the app with code immediately
                console.log('🚀 Updating Streamlit app with code from toolCall')
                setGeneratedCode(streamlitToolCall.args.code)
                await updateStreamlitApp(streamlitToolCall.args.code, true)
            }
        },
        onFinish: async (message) => {
            console.log('✨ onFinish:', {
                message,
                toolInvocations: message.toolInvocations,
                messages: messages,
                content: message.content
            })

            try {
                if (message.content && newChatIdRef.current && !currentChatId) {
                    const chatId = newChatIdRef.current
                    newChatIdRef.current = null
                    router.push(`/chat/${chatId}`)
                    Promise.all([
                        generateTitle(chatId),
                        message.toolInvocations && message.toolInvocations.length > 0
                            ? handleToolInvocations(message.toolInvocations as StreamlitToolCall[])
                            : Promise.resolve(),
                    ]).catch(console.error)
                    return
                }

                // Find the most recent tool invocation with code
                const streamlitCall = message.toolInvocations?.find(
                    invocation => invocation.toolName === 'streamlitTool' && 
                    invocation.args?.code
                ) as StreamlitToolCall | undefined

                if (streamlitCall?.args?.code && streamlitCall.args.code !== generatedCode) {
                    console.log('🚀 Updating Streamlit app with code from onFinish')
                    setGeneratedCode(streamlitCall.args.code)
                    await updateStreamlitApp(streamlitCall.args.code, true)
                }
            } catch (error) {
                console.error('Failed in onFinish:', error)
                setErrorState(error as Error)
            }
        },
    })

    // Improved Streamlit app management with retry logic
    const updateStreamlitApp = useCallback(
        async (code: string, forceExecute = false) => {
            if (!code) {
                setStreamlitUrl(null)
                setGeneratingCode(false)
                return null
            }

            if (isExecutingRef.current) {
                return null
            }

            isExecutingRef.current = true

            try {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const url = await updateSandbox(code, forceExecute)
                        if (url) {
                            setStreamlitUrl(url)
                            if (streamlitPreviewRef.current?.refreshIframe) {
                                await new Promise((resolve) =>
                                    setTimeout(resolve, 3000)
                                )
                                streamlitPreviewRef.current.refreshIframe()
                                setIsLoadingSandbox(false)
                            }
                            return url
                        }
                    } catch (error) {
                        if (attempt === 3) throw error
                        await new Promise((resolve) =>
                            setTimeout(resolve, attempt * 1000)
                        )
                    }
                }
                return null
            } catch (error) {
                console.error('Failed to update sandbox after retries:', error)
                setErrorState(error as Error)
                return null
            } finally {
                isExecutingRef.current = false
                setGeneratingCode(false)
            }
        },
        [
            updateSandbox,
            setStreamlitUrl,
            setGeneratingCode,
            setIsLoadingSandbox,
            currentChatId,
        ]
    )

    const handleToolInvocations = useCallback(
        async (toolInvocations: StreamlitToolCall[]) => {
            console.log('🛠️ Processing tool invocations:', toolInvocations)

            // Just in case onToolCall didn't catch it
            const streamlitCall = toolInvocations.find(
                call => call.toolName === 'streamlitTool' && call.args?.code
            )

            if (streamlitCall?.args?.code && streamlitCall.args.code !== generatedCode) {
                console.log('🚀 Updating Streamlit app with code from toolInvocations')
                setGeneratedCode(streamlitCall.args.code)
                await updateStreamlitApp(streamlitCall.args.code, true)
            }
        },
        [setGeneratedCode, updateStreamlitApp, generatedCode]
    )

    // Improved file upload with abort controller
    const handleFileUpload = useCallback(
        async (file: File, fileId: string) => {
            try {
                // Clear UI states first
                if (isNewChat) {
                    pendingFileLinkId.current = fileId
                    updateChatState({ status: 'active' }) // This will clear typing text
                }

                // Set loading states
                setHasFirstMessage(true)

                // Now append the message
                await append(
                    {
                        content: `Create a Streamlit app to visualize this data.`,
                        role: 'user',
                        createdAt: new Date(),
                    },
                    {
                        body: {
                            chatId: currentChatId,
                            fileId: fileId,
                            fileName: file.name,
                        },
                    }
                )
            } catch (error) {
                console.error('Error processing file:', error)
                setErrorState(error as Error)
            }
        },
        [append, currentChatId, isNewChat, updateChatState]
    )

    // Add handleSubmit to wrap the originalHandleSubmit
    const handleSubmit = useCallback(
        async (
            e: React.FormEvent,
            message: string,
            file?: File,
            fileId?: string
        ) => {
            e.preventDefault()
            setHasFirstMessage(true)

            // Validate message content
            if (file && fileId) {
                // Handle file upload case
                await handleFileUpload(file, fileId)
            } else if (message.trim()) {
                // Handle normal message case
                await originalHandleSubmit(e, {
                    body: {
                        fileIds: persistedFileIds,
                    },
                })
            }

            updateChatState({ status: 'active' })
        },
        [originalHandleSubmit, handleFileUpload, updateChatState, persistedFileIds]
    )

    const handleInputChange = useCallback(
        (value: string) => {
            originalHandleInputChange({
                target: { value },
            } as React.ChangeEvent<HTMLTextAreaElement>)
        },
        [originalHandleInputChange]
    )

    const handleRefresh = useCallback(async () => {
        if (sandboxId && session?.user?.id) {
            try {
                setGeneratingCode(true)
                await updateStreamlitApp(generatedCode, true)
            } catch (error) {
                console.error('Error refreshing app:', error)
            } finally {
                setGeneratingCode(false)
            }
        }
    }, [
        sandboxId,
        session?.user?.id,
        generatedCode,
        updateStreamlitApp,
        setGeneratingCode,
    ])

    const handleCodeViewToggle = useCallback(() => {
        setRightPanel((prev) => ({
            ...prev,
            view: prev.view === 'code' ? 'preview' : 'code',
        }))
    }, [])

    const handleChatSelect = useCallback(
        async (chatId: string) => {
            try {
                // Check if chat exists before navigating
                const response = await fetch(`/api/chats/${chatId}`)
                if (!response.ok) {
                    // Chat was deleted, refresh the chats list
                    const chatsResponse = await fetch('/api/chats')
                    if (chatsResponse.ok) {
                        const data = await chatsResponse.json()
                        setSidebarChats(data.chats)
                    }
                    router.push('/')
                    return
                }

                router.push(`/chat/${chatId}`)
            } catch (error) {
                console.error('Error selecting chat:', error)
                router.push('/')
            }
        },
        [router]
    )

    const handleVersionChange = useCallback(
        async (version: AppVersion) => {
            if (!version.code) return

            isVersionSwitching.current = true
            setGeneratingCode(true)

            try {
                setGeneratedCode(version.code)
                // Wait for sandbox update to complete
                await updateStreamlitApp(version.code, true)
            } catch (error) {
                setErrorState(error as Error)
            } finally {
                setGeneratingCode(false)
                isVersionSwitching.current = false
            }
        },
        [updateStreamlitApp, setGeneratingCode, setGeneratedCode]
    )

    const handleChatFinish = useCallback(() => {
        if (versionSelectorRef.current) {
            versionSelectorRef.current.refreshVersions()
        }
    }, [])

    const toggleRightContent = useCallback(() => {
        setRightPanel((prev) => ({
            ...prev,
            isVisible: !prev.isVisible,
        }))
    }, [])

    useEffect(() => {
        const loadChats = async () => {
            if (!session?.user?.id) return
            try {
                const response = await fetch('/api/chats')
                if (!response.ok) throw new Error('Failed to fetch chats')
                const data = await response.json()
                setSidebarChats(data.chats)
            } catch (error) {
                console.error('Error fetching chats:', error)
            }
        }

        loadChats()
    }, [session?.user?.id])

    useEffect(() => {
        const initializeChat = async () => {
            if (!currentChatId || isVersionSwitching.current || hasInitialized.current) return
            
            hasInitialized.current = true

            try {
                // Handle initial version if available
                const versionData = Array.isArray(initialVersion) ? initialVersion[0] : initialVersion
                if (versionData?.code) {
                    setRightPanel((prev) => ({
                        ...prev,
                        isVisible: true,
                    }))
                    setGeneratingCode(true)
                    setGeneratedCode(versionData.code)
                    await updateStreamlitApp(versionData.code, true)
                }

                // Load and set messages
                if (!initialMessages?.length) {
                    const messagesResponse = await fetch(`/api/chats/messages?chatId=${currentChatId}`)
                    if (!messagesResponse.ok) throw new Error('Failed to fetch messages')
                    const data = await messagesResponse.json()
                    
                    if (data.messages?.length) {
                        // Convert messages to Vercel AI SDK format
                        const formattedMessages = data.messages.map((msg: any) => ({
                            id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                            role: msg.role,
                            content: msg.content,
                            data: msg.data,
                            ...(msg.toolInvocations && { toolInvocations: msg.toolInvocations })
                        }))
                        setMessages(formattedMessages)
                    }
                } else {
                    // Format initial messages if provided
                    const formattedMessages = initialMessages.map((msg: any) => ({
                        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                        role: msg.role,
                        content: msg.content,
                        data: msg.data,
                        ...(msg.toolInvocations && { toolInvocations: msg.toolInvocations })
                    }))
                    setMessages(formattedMessages)
                }
            } catch (error) {
                console.error('Error initializing chat:', error)
                setErrorState(error as Error)
            } finally {
                setGeneratingCode(false)
            }
        }

        initializeChat()
    }, [currentChatId])

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            if (sandboxId) {
                killSandbox().catch(console.error)
            }
            isExecutingRef.current = false
            setStreamlitUrl(null)
            setGeneratedCode('')
        }
    }, [sandboxId, killSandbox, setStreamlitUrl, setGeneratedCode])

    // Add useEffect to handle window-dependent logic
    useEffect(() => {
        // This will only run on the client side
        const pathname = window.location.pathname
        const chatId = pathname.startsWith('/chat/')
            ? pathname.split('/').pop()
            : undefined
        setCurrentChatId(chatId)
    }, [])
    // Title generation
    const generateTitle = useCallback(
        async (chatId: string) => {
            if (titleGeneratedRef.current.has(chatId)) {
                return null
            }

            try {
                const response = await fetch(`/api/chats/${chatId}/title`, {
                    method: 'POST',
                })

                if (!response.ok) throw new Error('Failed to generate title')

                const data = await response.json()

                if (data.title) {
                    setChatTitles((prev) => ({ ...prev, [chatId]: data.title }))
                    titleGeneratedRef.current.add(chatId)

                    // Refresh chats list
                    const chatsResponse = await fetch('/api/chats')
                    if (chatsResponse.ok) {
                        const data = await chatsResponse.json()
                        setSidebarChats(data.chats)
                    }
                }

                return data.title
            } catch (error) {
                console.error('Error generating title:', error)
                return null
            }
        },
        [setSidebarChats]
    )

    const handleFileSelection = useCallback((fileIds: string[]) => {
        setPersistedFileIds(fileIds)
        if (currentChatId) {
            // First remove any existing chat_files associations
            fetch(`/api/chats/${currentChatId}/files`, {
                method: 'DELETE',
            })
            .then(() => {
                // Then create new associations for all selected files
                fetch(`/api/chats/${currentChatId}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileIds }),
                })
            })
            .catch(console.error)
        }
    }, [currentChatId])

    // Loading states
    if (isLoading) {
        return (
            <div className="relative h-screen w-full">
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0" />
                <LoadingAnimation message="Loading..." />
            </div>
        )
    }

    const CustomHandle = ({ ...props }) => (
        <ResizableHandle
            {...props}
            withHandle
            className="relative bg-transparent"
        >
            <div className="absolute inset-y-0 left-1/2 flex w-4 -translate-x-1/2 items-center justify-center">
                <div className="h-8 w-1 rounded-full bg-black dark:bg-white" />
            </div>
        </ResizableHandle>
    )

    return (
        <div className="bg-white dark:bg-dark-app relative flex h-screen overflow-hidden">
            {/* Add a simple fade transition during navigation */}
            {isNavigating && (
                <div className="absolute inset-0 bg-background/50 z-50 transition-opacity duration-200" />
            )}

            <div className="absolute top-0 left-0 w-full h-full">
                <div className="godrays top-0 left-0 w-full min-h-[30vh] relative z-5">
                    <div className="godrays-overlay dark:mix-blend-darken z-10" />
                </div>
            </div>
            <AppSidebar
                onChatSelect={handleChatSelect}
                currentChatId={currentChatId || null}
                chats={sidebarChats}
                isCreatingChat={isCreatingChat}
                chatTitles={chatTitles}
                onGenerateTitle={generateTitle}
                onChatDeleted={() => {
                    // Clear current chat state
                    setCurrentAppId(null)
                    setMessages([])
                    setGeneratedCode('')
                    setStreamlitUrl(null)

                    // Reset UI state
                    setRightPanel({
                        isVisible: false,
                        view: 'preview',
                    })

                    // Refresh chats list
                    fetch('/api/chats')
                        .then((response) => response.json())
                        .then((data) => setSidebarChats(data.chats))
                        .catch(console.error)
                    router.push('/')
                }}
            />
            <div className="flex-1 flex flex-col bg-white dark:bg-dark-app min-w-0">
                {sidebarCollapsed && (
                    <div
                        className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200"
                        style={{
                            left: '4rem',
                            right: 0,
                        }}
                    ></div>
                )}
                <main
                    className={cn(
                        'flex-grow flex px-2 pr-9 flex-col lg:flex-row overflow-hidden justify-center relative',
                        'h-screen pt-14'
                    )}
                >
                    <ResizablePanelGroup
                        direction="horizontal"
                        ref={resizableGroupRef}
                    >
                        <ResizablePanel defaultSize={40} minSize={30}>
                            <div
                                className={cn(
                                    'w-full relative flex flex-col',
                                    hasFirstMessage || isInChatPage
                                        ? 'h-[calc(100vh-4rem)]'
                                        : 'h-screen'
                                )}
                            >
                                {!isInChatPage &&
                                    chatState.status === 'initial' && (
                                        <TypingText
                                            className="text-black dark:text-dark-text font-bold text-3xl"
                                            text="From Data to Apps, in seconds"
                                            speed={30}
                                            show={true}
                                        />
                                    )}
                                <div className="max-w-[800px] mx-auto w-full h-full">
                                    <Chat
                                        messages={isNavigating ? [] : messages}
                                        isLoading={chatLoading || isNavigating}
                                        input={input}
                                        onInputChange={handleInputChange}
                                        onSubmit={handleSubmit}
                                        fileUploadState={fileUploadState}
                                        errorState={errorState}
                                        onErrorDismiss={() =>
                                            setErrorState(null)
                                        }
                                        onChatFinish={handleChatFinish}
                                        onUpdateStreamlit={updateStreamlitApp}
                                        onCodeClick={() => {
                                            setRightPanel((prev) => ({
                                                ...prev,
                                                view: 'code',
                                            }))
                                        }}
                                        onTogglePanel={toggleRightContent}
                                        isInChatPage={
                                            isInChatPage || hasFirstMessage
                                        }
                                        selectedFileIds={persistedFileIds}
                                        onFileSelect={handleFileSelection}
                                        chatId={currentChatId}
                                    />
                                </div>
                            </div>
                        </ResizablePanel>

                        {rightPanel.isVisible && (
                            <>
                                <CustomHandle className="bg-gradient-to-r from-black/10 to-black/5 hover:from-black/20 hover:to-black/10 dark:from-white/10 dark:to-white/5 dark:hover:from-white/20 dark:hover:to-white/10 transition-colors" />
                                <ResizablePanel
                                    defaultSize={60}
                                    minSize={40}
                                    className="w-full lg:w-1/2 p-4 flex flex-col overflow-hidden rounded-xl bg-white dark:bg-dark-app h-[calc(100vh-4rem)] border border-gray-200 dark:border-dark-border"
                                >
                                    <PreviewPanel
                                        key={`preview-${previewKey}`}
                                        ref={streamlitPreviewRef}
                                        appId={currentAppId || undefined}
                                        streamlitUrl={streamlitUrl}
                                        generatedCode={generatedCode}
                                        isLoadingSandbox={isLoadingSandbox}
                                        isGeneratingCode={isGeneratingCode}
                                        showCodeView={
                                            rightPanel.view === 'code'
                                        }
                                        onCodeViewToggle={handleCodeViewToggle}
                                        onRefresh={handleRefresh}
                                    />
                                </ResizablePanel>
                            </>
                        )}
                    </ResizablePanelGroup>
                    <div className="absolute top-2 right-4 z-30 flex justify-between items-center gap-4">
                        {currentAppId && (
                            <VersionSelector
                                key={`version-${versionKey}`}
                                appId={currentAppId}
                                onVersionChange={handleVersionChange}
                                ref={versionSelectorRef}
                            />
                        )}

                        <Button
                            onClick={toggleRightContent}
                            className={cn(
                                'bg-black dark:bg-dark-background dark:border-neutral-400 hover:bg-black/90',
                                'text-white',
                                'border border-transparent dark:border-dark-border',
                                'transition-all duration-200 ease-in-out',
                                'shadow-lg hover:shadow-xl',
                                'rounded-lg'
                            )}
                            size="icon"
                        >
                            {rightPanel.isVisible ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <ChevronLeft className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </main>
            </div>

            {shouldShowAuthPrompt && <AuthPrompt />}
        </div>
    )
}


=== ./components/AppLayout.tsx ===

import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import AppSidebar from './Sidebar'
import { AuthPrompt } from './ui/auth-prompt'
import LoadingAnimation from './LoadingAnimation'
import { useRouter } from 'next/navigation'

interface AppLayoutProps {
  children: React.ReactNode
  rightPanel: React.ReactNode
  showRightPanel: boolean
  onToggleRightPanel: () => void
  chats: any[]
  chatTitles: Record<string, string>
  currentChatId: string | null
  isCreatingChat: boolean
  onChatSelect: (id: string) => void
  onGenerateTitle: (id: string) => Promise<string | null>
  onChatDeleted: () => void
}

export function AppLayout({ 
  children, 
  rightPanel,
  showRightPanel,
  onToggleRightPanel,
  chats,
  chatTitles,
  currentChatId,
  isCreatingChat,
  onChatSelect,
  onGenerateTitle,
  onChatDeleted
}: AppLayoutProps) {
  const { session, isLoading, shouldShowAuthPrompt } = useAuth()
  const { collapsed: sidebarCollapsed } = useSidebar()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="relative h-screen w-full">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0" />
        <LoadingAnimation message="Loading..." />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-dark-app relative flex h-screen overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="godrays top-0 left-0 w-full min-h-[30vh] relative z-5">
          <div className="godrays-overlay dark:mix-blend-darken z-10" />
        </div>
      </div>

      <AppSidebar
        chats={chats}
        chatTitles={chatTitles}
        currentChatId={currentChatId}
        isCreatingChat={isCreatingChat}
        onChatSelect={onChatSelect}
        onGenerateTitle={onGenerateTitle}
        onChatDeleted={onChatDeleted}
      />

      <div className="flex-1 flex flex-col bg-white dark:bg-dark-app min-w-0">
        {sidebarCollapsed && (
          <div
            className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200"
            style={{
              left: '4rem',
              right: 0,
            }}
          />
        )}

        <main className={cn(
          'flex-grow flex px-2 pr-9 flex-col lg:flex-row overflow-hidden justify-center relative',
          'h-screen pt-14'
        )}>
          <div className="w-full relative flex flex-col h-[calc(100vh-4rem)]">
            {children}
          </div>

          {showRightPanel && (
            <div className={cn(
              "fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-1/3 bg-white dark:bg-dark-app border-l border-gray-200 dark:border-dark-border transform transition-transform duration-300",
              showRightPanel ? "translate-x-0" : "translate-x-full"
            )}>
              {rightPanel}
            </div>
          )}

          {showRightPanel && (
            <Button
              onClick={onToggleRightPanel}
              className={cn(
                'fixed right-4 top-4 z-30',
                'bg-black dark:bg-dark-background dark:border-neutral-400 hover:bg-black/90',
                'text-white',
                'border border-transparent dark:border-dark-border',
                'transition-all duration-200 ease-in-out',
                'shadow-lg hover:shadow-xl',
                'rounded-lg'
              )}
              size="icon"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </main>
      </div>

      {shouldShowAuthPrompt && <AuthPrompt />}
    </div>
  )
} 

=== ./components/AppCard.tsx ===

import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface AppCardProps {
    name: string
    description: string | null
    updatedAt: string
    onClick?: () => void
}

export function AppCard({ name, description, updatedAt, onClick }: AppCardProps) {
    return (
        <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={onClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold leading-none tracking-tight">{name}</h3>
                    <p className="text-sm text-muted-foreground">{updatedAt}</p>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {description || 'No description'}
                </p>
            </CardContent>
        </Card>
    )
} 

=== ./components/AppHeader.tsx ===

'use client'

import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { AppVersion } from '@/lib/types'
import { Code2, Info, RefreshCcw } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { Logo } from './core/Logo'
import { StreamlitFrameRef } from './StreamlitFrame'
import { Button } from './ui/button'
import { ThemeSwitcherButton } from './ui/theme-button-switcher'
import { VersionSelector } from './VersionSelector'
import Link from 'next/link'

interface AppHeaderProps {
    appId: string
    appName: string
    appDescription?: string
    initialVersions: AppVersion[]
    initialUrl: string
    streamlitRef?: React.RefObject<StreamlitFrameRef>
    onToggleCode?: () => void
}

export function AppHeader({
    appId,
    appName,
    appDescription = 'No description available',
    streamlitRef,
    onToggleCode,
}: AppHeaderProps) {
    const {
        updateSandbox,
        setGeneratingCode,
        setGeneratedCode,
        setIsLoadingSandbox,
    } = useSandboxStore()
    const isUpdatingRef = useRef(false)

    const handleVersionChange = useCallback(
        async (version: AppVersion) => {
            if (!version.code || isUpdatingRef.current) return

            isUpdatingRef.current = true
            setGeneratingCode(true)

            try {
                setIsLoadingSandbox(true)
                setGeneratedCode(version.code)
                await updateSandbox(version.code, true)

                if (streamlitRef?.current) {
                    await new Promise((resolve) =>
                        requestAnimationFrame(resolve)
                    )
                    await new Promise((resolve) => setTimeout(resolve, 2000))
                    streamlitRef.current.refreshIframe()
                }
            } catch (error) {
                console.error('Error updating version:', error)
            } finally {
                setGeneratingCode(false)
                setIsLoadingSandbox(false)
                isUpdatingRef.current = false
            }
        },
        [updateSandbox, setGeneratingCode, setGeneratedCode, streamlitRef]
    )

    const handleRefresh = useCallback(() => {
        if (streamlitRef?.current) {
            streamlitRef.current.refreshIframe()
        }
    }, [streamlitRef])

    const toggleCodeView = () => {
        onToggleCode?.()
    }

    return (
        <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-dark-app z-50">
            <div className="h-full px-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Logo inverted={true} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <HoverCard>
                            <HoverCardTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <Info className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
                                </Button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">
                                        {appName}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        {appDescription}
                                    </p>
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleRefresh}
                                    className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <RefreshCcw className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Refresh App</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleCodeView}
                                    className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <Code2 className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View Code</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <VersionSelector
                        appId={appId}
                        onVersionChange={handleVersionChange}
                    />
                    <ThemeSwitcherButton showLabel={false} />
                </div>
            </div>
        </header>
    )
}



=== ./components/hooks/use-auto-resize-textarea.ts ===

import { useCallback, useEffect, useRef } from 'react'

interface UseAutoResizeTextareaProps {
    minHeight: number
    maxHeight?: number
}

export function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current
            if (!textarea) return

            // Reset ke case mein minHeight set karenge
            if (reset) {
                textarea.style.height = `${minHeight}px`
                return
            }

            // Normal case mein maxHeight set karenge
            if (maxHeight) {
                textarea.style.height = `${maxHeight}px`
            } else {
                textarea.style.height = `${minHeight}px`
            }
        },
        [minHeight, maxHeight]
    )

    useEffect(() => {
        // Initial height set karo - by default maxHeight
        const textarea = textareaRef.current
        if (textarea && maxHeight) {
            textarea.style.height = `${maxHeight}px`
        } else if (textarea) {
            textarea.style.height = `${minHeight}px`
        }
    }, [minHeight, maxHeight])

    useEffect(() => {
        const handleResize = () => adjustHeight()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [adjustHeight])

    return { textareaRef, adjustHeight }
}


=== ./components/hooks/use-mobile.ts ===

import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
        undefined
    )

    React.useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        }
        mql.addEventListener('change', onChange)
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        return () => mql.removeEventListener('change', onChange)
    }, [])

    return !!isMobile
}


=== ./components/LoadingOverlay.tsx ===



=== ./components/Sidebar.tsx ===

'use client'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Session } from '@supabase/supabase-js'
import { FileData, AppData } from '@/lib/types'
import {
    AppWindow,
    BadgeCheck,
    ChevronRight,
    ChevronsUpDown,
    CreditCard,
    File,
    LogOut,
    Menu,
    MessageSquare,
    MoveRight,
    Plus,
    Sparkles,
    Trash2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
} from '@/components/ui/sidebar'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ThemeSwitcherButton } from '@/components/ui/theme-button-switcher'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from './core/Logo'

interface Chat {
    id: string
    name: string
    created_at: string
    last_message?: string
}

interface SidebarProps {
    onChatSelect: (chatId: string) => void
    currentChatId: string | null
    chats?: Chat[]
    isCreatingChat: boolean
    chatTitles: Record<string, string>
    onGenerateTitle: (chatId: string) => Promise<string | null>
    onChatDeleted: () => void
}

const TypewriterText = ({ text }: { text: string }) => {
    return (
        <motion.span
            initial={{ opacity: 0 }}
            animate={{
                opacity: 1,
                transition: {
                    duration: 0.2,
                },
            }}
        >
            {text.split('').map((char, index) => (
                <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                        duration: 0.1,
                        delay: index * 0.05,
                        ease: 'easeInOut',
                    }}
                >
                    {char}
                </motion.span>
            ))}
        </motion.span>
    )
}

const CustomSidebarMenuSubItem = ({
    isActive,
    children,
    className,
}: {
    isActive?: boolean
    children: React.ReactNode
    className?: string
}) => (
    <div
        className={`${className} ${isActive ? 'bg-accent/50' : 'bg-background hover:bg-accent/30'}`}
    >
        {children}
    </div>
)

interface ChatsListProps {
    chats: Chat[]
    onChatSelect: (chatId: string) => void
    currentChatId: string | null
    isCreatingChat: boolean
    chatTitles: Record<string, string>
    onGenerateTitle: (chatId: string) => Promise<string | null>
    onChatDeleted: () => void
}

const ChatsList = ({
    chats = [],
    onChatSelect,
    currentChatId,
    isCreatingChat,
    chatTitles,
    onGenerateTitle,
    onChatDeleted,
}: ChatsListProps) => {
    const router = useRouter()
    const visibleChats = chats.slice(0, 10)

    useEffect(() => {
        const generateMissingTitles = async () => {
            console.log('🔍 Checking for chats without titles...')
            for (const chat of chats) {
                if (!chat.name && !chatTitles[chat.id]) {
                    console.log('📝 Requesting title for chat:', chat.id)
                    await onGenerateTitle(chat.id)
                }
            }
        }

        generateMissingTitles()
    }, [chats, chatTitles, onGenerateTitle])

    const getChatTitle = (chat: Chat) => {
        return chat.name || chatTitles[chat.id] || 'New Project'
    }

    return (
        <SidebarMenuSub>
            <AnimatePresence>
                {isCreatingChat && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                    >
                        <CustomSidebarMenuSubItem className="group/item relative bg-sidebar-accent">
                            <SidebarMenuSubButton className="w-full text-left flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 animate-pulse" />
                                <TypewriterText text={getChatTitle(chats[0])} />
                                <span className="ml-2 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            </SidebarMenuSubButton>
                        </CustomSidebarMenuSubItem>
                    </motion.div>
                )}

                {visibleChats.map((chat, index) => (
                    <motion.div
                        key={chat.id}
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{
                            duration: 0.3,
                            delay: index * 0.1,
                            type: 'spring',
                            stiffness: 200,
                            damping: 20,
                        }}
                    >
                        <CustomSidebarMenuSubItem
                            className={`group/item relative`}
                            isActive={currentChatId === chat.id}
                        >
                            <SidebarMenuSubButton
                                className="w-full text-left flex items-center gap-2"
                                onClick={() => onChatSelect(chat.id)}
                            >
                                <MessageSquare className="h-4 w-4" />
                                <span className="truncate">
                                    {chat.name || `Chat ${chat.id.slice(0, 8)}`}
                                </span>
                            </SidebarMenuSubButton>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="invisible absolute right-2 top-1/2 -translate-y-1/2 group-hover/item:visible h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-[400px]">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-semibold text-foreground">
                                            Delete Project
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-muted-foreground/80 pt-2">
                                            Are you sure you want to delete this
                                            project? This action cannot be
                                            undone and will permanently delete
                                            all associated data.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-4 gap-2">
                                        <AlertDialogCancel className="border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={async () => {
                                                try {
                                                    const response =
                                                        await fetch(
                                                            `/api/chats/${chat.id}`,
                                                            {
                                                                method: 'DELETE',
                                                            }
                                                        )

                                                    if (!response.ok) {
                                                        throw new Error(
                                                            'Failed to delete chat'
                                                        )
                                                    }

                                                    onChatDeleted()

                                                    if (
                                                        currentChatId ===
                                                        chat.id
                                                    ) {
                                                        router.push('/')
                                                    }
                                                } catch (error) {
                                                    console.error(
                                                        'Failed to delete chat:',
                                                        error
                                                    )
                                                }
                                            }}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-red-600 dark:text-white dark:hover:bg-red-700 transition-colors"
                                        >
                                            Delete Project
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CustomSidebarMenuSubItem>
                    </motion.div>
                ))}
            </AnimatePresence>

            {chats.length > 0 && (
                <CustomSidebarMenuSubItem className="group/item relative hover:underline mt-2">
                    <SidebarMenuSubButton
                        className="w-full cursor-pointer text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1 text-sm pl-2"
                        onClick={() => router.push('/vault/chat')}
                    >
                        View all
                        <MoveRight className="h-3 w-3" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            )}
        </SidebarMenuSub>
    )
}

const FilesList = () => {
    const [files, setFiles] = useState<FileData[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()
    const { session } = useAuth()

    useEffect(() => {
        const fetchFiles = async () => {
            if (!session?.user?.id) return
            
            try {
                const { data, error } = await supabase
                    .from('files')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('updated_at', { ascending: false })
                    .limit(3)

                if (error) throw error

                const mappedFiles = data.map(file => ({
                    id: file.id,
                    name: file.file_name,
                    type: file.file_type,
                    updated_at: file.updated_at
                }))
                setFiles(mappedFiles)
            } catch (error) {
                console.error('Error fetching files:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchFiles()
    }, [supabase, session?.user?.id])

    if (loading) {
        return (
            <SidebarMenuSub>
                <CustomSidebarMenuSubItem>
                    <SidebarMenuSubButton className="w-full text-left flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                        <div className="h-4 w-24 animate-pulse bg-muted rounded" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            </SidebarMenuSub>
        )
    }

    return (
        <SidebarMenuSub>
            {files.map((file) => (
                <CustomSidebarMenuSubItem key={file.id}>
                    <SidebarMenuSubButton
                        className="w-full text-left flex items-center gap-2"
                        onClick={() => router.push(`/files/${file.id}`)}
                    >
                        <File className="h-4 w-4" />
                        <span className="truncate">{file.name}</span>
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            ))}
            {files.length > 0 && (
                <CustomSidebarMenuSubItem className="group/item relative hover:underline mt-2">
                    <SidebarMenuSubButton
                        className="w-full cursor-pointer text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1 text-sm pl-2"
                        onClick={() => router.push('/files')}
                    >
                        View all
                        <MoveRight className="h-3 w-3" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            )}
        </SidebarMenuSub>
    )
}

const AppsList = () => {
    const [apps, setApps] = useState<AppData[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()
    const { session } = useAuth()

    useEffect(() => {
        const fetchApps = async () => {
            if (!session?.user?.id) return
            
            try {
                const { data, error } = await supabase
                    .from('apps')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('updated_at', { ascending: false })
                    .limit(3)

                if (error) throw error
                setApps(data)
            } catch (error) {
                console.error('Error fetching apps:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchApps()
    }, [supabase, session?.user?.id])

    if (loading) {
        return (
            <SidebarMenuSub>
                <CustomSidebarMenuSubItem>
                    <SidebarMenuSubButton className="w-full text-left flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                        <div className="h-4 w-24 animate-pulse bg-muted rounded" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            </SidebarMenuSub>
        )
    }

    return (
        <SidebarMenuSub>
            {apps.map((app) => (
                <CustomSidebarMenuSubItem key={app.id}>
                    <SidebarMenuSubButton 
                        className="w-full text-left flex items-center gap-2"
                        onClick={() => router.push(`/apps/${app.id}`)}
                    >
                        <AppWindow className="h-4 w-4" />
                        <span className="truncate">{app.name}</span>
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            ))}
            {apps.length > 0 && (
                <CustomSidebarMenuSubItem className="group/item relative hover:underline mt-2">
                    <SidebarMenuSubButton
                        className="w-full cursor-pointer text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1 text-sm pl-2"
                        onClick={() => router.push('/apps')}
                    >
                        View all
                        <MoveRight className="h-3 w-3" />
                    </SidebarMenuSubButton>
                </CustomSidebarMenuSubItem>
            )}
        </SidebarMenuSub>
    )
}

export default function AppSidebar({
    onChatSelect,
    currentChatId,
    chats = [],
    isCreatingChat,
    chatTitles,
    onGenerateTitle,
    onChatDeleted,
}: SidebarProps) {
    const [open, setOpen] = useState(false)
    const [isChatsOpen, setIsChatsOpen] = useState(true)
    const [isFilesOpen, setIsFilesOpen] = useState(false)
    const [isAppsOpen, setIsAppsOpen] = useState(false)
    const router = useRouter()
    const [session, setSession] = useState<Session | null>(null)
    const supabase = createClient()
    const { isPreviewMode, showAuthPrompt } = useAuth()

    useEffect(() => {
        const getSession = async () => {
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession()
            setSession(currentSession)
        }

        getSession()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [supabase.auth])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Mobile sidebar
    const MobileSidebar = () => (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
                <SidebarProvider>
                    <Sidebar>
                        <SidebarContent>
                            <ScrollArea className="h-[calc(100vh-8rem)]">
                                <SidebarGroup>
                                    <SidebarMenu>
                                        <SidebarMenuItem className="flex justify-center">
                                            <SidebarMenuButton
                                                onClick={() => router.push('/')}
                                                className="w-full flex items-center justify-center bg-background border border-border hover:bg-accent"
                                            >
                                                {!open && (
                                                    <Plus className="h-4 w-4" />
                                                )}
                                                {open && (
                                                    <span>New Project</span>
                                                )}
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                </SidebarGroup>

                                <SidebarGroup>
                                    <SidebarGroupLabel>Hub</SidebarGroupLabel>
                                    <Collapsible
                                        open={isChatsOpen}
                                        onOpenChange={setIsChatsOpen}
                                    >
                                        <SidebarMenu>
                                            <SidebarMenuItem className="flex justify-center">
                                                <SidebarMenuButton
                                                    className="w-full flex items-center jusitfy-between"
                                                    tooltip="Your previous chats"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                    {open && (
                                                        <span className="ml-2">
                                                            Projects
                                                        </span>
                                                    )}
                                                </SidebarMenuButton>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuAction>
                                                        <ChevronRight
                                                            className={cn(
                                                                'h-4 w-4 transition-transform',
                                                                isChatsOpen &&
                                                                    'rotate-90'
                                                            )}
                                                        />
                                                    </SidebarMenuAction>
                                                </CollapsibleTrigger>
                                            </SidebarMenuItem>
                                        </SidebarMenu>
                                        <CollapsibleContent>
                                            <ChatsList
                                                chats={chats}
                                                onChatSelect={onChatSelect}
                                                currentChatId={currentChatId}
                                                isCreatingChat={isCreatingChat}
                                                chatTitles={chatTitles}
                                                onGenerateTitle={
                                                    onGenerateTitle
                                                }
                                                onChatDeleted={onChatDeleted}
                                            />
                                        </CollapsibleContent>
                                    </Collapsible>

                                    <SidebarSeparator className="my-2" />

                                    <Collapsible
                                        open={isFilesOpen}
                                        onOpenChange={setIsFilesOpen}
                                    >
                                        <SidebarMenu>
                                            <SidebarMenuItem className="flex justify-center">
                                                <SidebarMenuButton
                                                    className="w-full flex items-center jusitfy-between"
                                                    tooltip="Manage your files"
                                                    onClick={() => router.push('/files')}
                                                >
                                                    <File className="h-4 w-4" />
                                                    {open && (
                                                        <span className="ml-2">
                                                            Files
                                                        </span>
                                                    )}
                                                </SidebarMenuButton>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuAction>
                                                        <ChevronRight 
                                                            className={cn(
                                                                'h-4 w-4 transition-transform',
                                                                isFilesOpen &&
                                                                    'rotate-90'
                                                            )}
                                                        />
                                                    </SidebarMenuAction>
                                                </CollapsibleTrigger>
                                            </SidebarMenuItem>
                                        </SidebarMenu>
                                        <CollapsibleContent>
                                            <FilesList />
                                        </CollapsibleContent>
                                    </Collapsible>

                                    <Collapsible
                                        open={isAppsOpen}
                                        onOpenChange={setIsAppsOpen}
                                    >
                                        <SidebarMenu>
                                            <SidebarMenuItem className="flex justify-center">
                                                <SidebarMenuButton
                                                    className="w-full flex items-center jusitfy-between"
                                                    tooltip="Your applications"
                                                    onClick={() => router.push('/apps')}
                                                >
                                                    <AppWindow className="h-4 w-4" />
                                                    {open && (
                                                        <span className="ml-2">
                                                            Apps
                                                        </span>
                                                    )}
                                                </SidebarMenuButton>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuAction>
                                                        <ChevronRight 
                                                            className={cn(
                                                                'h-4 w-4 transition-transform',
                                                                isAppsOpen &&
                                                                    'rotate-90'
                                                            )}
                                                        />
                                                    </SidebarMenuAction>
                                                </CollapsibleTrigger>
                                            </SidebarMenuItem>
                                        </SidebarMenu>
                                        <CollapsibleContent>
                                            <AppsList />
                                        </CollapsibleContent>
                                    </Collapsible>
                                </SidebarGroup>
                            </ScrollArea>
                        </SidebarContent>
                        <SidebarFooter>
                            <SidebarMenu>
                                <SidebarMenuItem className="flex justify-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <SidebarMenuButton
                                                size="lg"
                                                className="w-full flex items-center justify-center data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                            >
                                                <Avatar className="h-8 w-8 rounded-lg">
                                                    <AvatarImage
                                                        src={
                                                            session?.user
                                                                ?.user_metadata
                                                                ?.avatar_url ||
                                                            '/default-avatar.png'
                                                        }
                                                        alt={
                                                            session?.user
                                                                ?.user_metadata
                                                                ?.full_name ||
                                                            'User'
                                                        }
                                                    />
                                                    <AvatarFallback className="rounded-lg">
                                                        {session?.user
                                                            ?.user_metadata
                                                            ?.full_name?.[0] ||
                                                            'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {open && (
                                                    <>
                                                        <div className="grid flex-1 text-left text-sm leading-tight ml-2">
                                                            <span className="truncate font-semibold">
                                                                {session?.user
                                                                    ?.user_metadata
                                                                    ?.full_name ||
                                                                    'Guest User'}
                                                            </span>
                                                            <span className="truncate text-xs">
                                                                {session?.user
                                                                    ?.email ||
                                                                    'Not signed in'}
                                                            </span>
                                                        </div>
                                                        <ChevronsUpDown className="ml-auto size-4" />
                                                    </>
                                                )}
                                            </SidebarMenuButton>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            className="w-56 rounded-lg"
                                            align="end"
                                            sideOffset={4}
                                        >
                                            <DropdownMenuLabel className="font-normal">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8 rounded-lg">
                                                        <AvatarImage
                                                            src={
                                                                session?.user
                                                                    ?.user_metadata
                                                                    ?.avatar_url ||
                                                                '/default-avatar.png'
                                                            }
                                                            alt={
                                                                session?.user
                                                                    ?.user_metadata
                                                                    ?.full_name ||
                                                                'User'
                                                            }
                                                        />
                                                        <AvatarFallback className="rounded-lg">
                                                            {session?.user
                                                                ?.user_metadata
                                                                ?.full_name?.[0] ||
                                                                'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                                        <span className="font-semibold">
                                                            {session?.user
                                                                ?.user_metadata
                                                                ?.full_name ||
                                                                'Guest User'}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {session?.user
                                                                ?.email ||
                                                                'Not signed in'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuItem>
                                                    <Sparkles className="mr-2 h-4 w-4" />
                                                    <span>Upgrade to Pro</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuItem>
                                                    <BadgeCheck className="mr-2 h-4 w-4" />
                                                    <span>Account</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <CreditCard className="mr-2 h-4 w-4" />
                                                    <span>Billing</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="cursor-default hover:!bg-transparent"
                                                    onSelect={(e) =>
                                                        e.preventDefault()
                                                    }
                                                >
                                                    <div className="w-full">
                                                        <ThemeSwitcherButton />
                                                    </div>
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={handleSignOut}
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                <span>Log out</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarFooter>
                        <SidebarRail />
                    </Sidebar>
                </SidebarProvider>
            </SheetContent>
        </Sheet>
    )

    const userProfile = isPreviewMode ? (
        <SidebarMenuItem className="flex justify-center">
            <Button
                variant="secondary"
                className="w-full relative group hover:opacity-90 transition-all duration-200 rounded-xl border shadow-sm bg-background/80 backdrop-blur-sm hover:shadow-md hover:scale-[1.02]"
                onClick={async () => {
                    const supabase = createClient()
                    await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: `https://pyapps.co/auth/callback`,
                        },
                    })
                }}
            >
                <div className={cn(
                    "flex items-center gap-2",
                    !open && "justify-center w-full"
                )}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    {open && (
                        <span className="font-medium">
                            Continue with Google
                        </span>
                    )}
                </div>
            </Button>
        </SidebarMenuItem>
    ) : (
        <SidebarMenuItem className="flex justify-center">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                        size="lg"
                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                        <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarImage
                                src={
                                    session?.user?.user_metadata?.avatar_url ||
                                    '/default-avatar.png'
                                }
                                alt={
                                    session?.user?.user_metadata?.full_name ||
                                    'User'
                                }
                            />
                            <AvatarFallback className="rounded-lg">
                                {session?.user?.user_metadata?.full_name?.[0] ||
                                    'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">
                                {session?.user?.user_metadata?.full_name ||
                                    'Guest User'}
                            </span>
                            <span className="truncate text-xs">
                                {session?.user?.email || 'Not signed in'}
                            </span>
                        </div>
                        <ChevronsUpDown className="ml-auto size-4" />
                    </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                    side="bottom"
                    align="end"
                    sideOffset={4}
                >
                    <DropdownMenuLabel className="p-0 font-normal">
                        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarImage
                                    src={
                                        session?.user?.user_metadata
                                            ?.avatar_url ||
                                        '/default-avatar.png'
                                    }
                                    alt={
                                        session?.user?.user_metadata
                                            ?.full_name || 'User'
                                    }
                                />
                                <AvatarFallback className="rounded-lg">
                                    CN
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">
                                    {session?.user?.user_metadata?.full_name ||
                                        'Guest User'}
                                </span>
                                <span className="truncate text-xs">
                                    {session?.user?.email || 'Not signed in'}
                                </span>
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem>
                            <Sparkles />
                            Upgrade to Pro
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem>
                            <BadgeCheck />
                            Account
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <CreditCard />
                            Billing
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="cursor-default hover:!bg-transparent"
                            onSelect={(e) => e.preventDefault()}
                        >
                            <div className="w-full">
                                <ThemeSwitcherButton />
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut />
                        Log out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    )

    return (
        <div className="flex z-50">
            <MobileSidebar />
            <SidebarProvider open={open} onOpenChange={setOpen}>
                <Sidebar
                    variant="sidebar"
                    collapsible="icon"
                    className="hidden md:flex"
                >
                    <SidebarHeader>
                        <SidebarMenu>
                            <SidebarMenuItem className="w-full flex justify-between items-center">
                                <Link
                                    href="/"
                                    className="flex items-center gap-2"
                                >
                                    <Logo inverted collapsed={!open} />
                                </Link>
                                {open && (
                                    <SidebarTrigger className="relative z-30" />
                                )}
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarHeader>
                    <SidebarContent>
                        <ScrollArea className="h-[calc(100vh-8rem)]">
                            <SidebarGroup>
                                <SidebarMenu>
                                    <SidebarMenuItem className="flex justify-center">
                                        <SidebarMenuButton
                                            onClick={() => router.push('/')}
                                            className="w-full flex items-center justify-center bg-background border border-border hover:bg-accent"
                                        >
                                            {!open && (
                                                <Plus className="h-4 w-4" />
                                            )}
                                            {open && <span>New Project</span>}
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroup>

                            <SidebarGroup>
                                <SidebarGroupLabel>Hub</SidebarGroupLabel>
                                <Collapsible
                                    open={isChatsOpen}
                                    onOpenChange={setIsChatsOpen}
                                >
                                    <SidebarMenu>
                                        <SidebarMenuItem className="flex justify-center">
                                            <SidebarMenuButton
                                                className="w-full flex items-center jusitfy-between"
                                                tooltip="Your previous chats"
                                            >
                                                <MessageSquare className="h-4 w-4" />
                                                {open && (
                                                    <span className="ml-2">
                                                        Projects
                                                    </span>
                                                )}
                                            </SidebarMenuButton>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuAction>
                                                    <ChevronRight
                                                        className={cn(
                                                            'h-4 w-4 transition-transform',
                                                            isChatsOpen &&
                                                                'rotate-90'
                                                        )}
                                                    />
                                                </SidebarMenuAction>
                                            </CollapsibleTrigger>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                    <CollapsibleContent>
                                        <ChatsList
                                            chats={chats}
                                            onChatSelect={onChatSelect}
                                            currentChatId={currentChatId}
                                            isCreatingChat={isCreatingChat}
                                            chatTitles={chatTitles}
                                            onGenerateTitle={onGenerateTitle}
                                            onChatDeleted={onChatDeleted}
                                        />
                                    </CollapsibleContent>
                                </Collapsible>

                                <SidebarSeparator className="my-2" />

                                <Collapsible
                                    open={isFilesOpen}
                                    onOpenChange={setIsFilesOpen}
                                >
                                    <SidebarMenu>
                                        <SidebarMenuItem className="flex justify-center">
                                            <SidebarMenuButton
                                                className="w-full flex items-center jusitfy-between"
                                                tooltip="Manage your files"
                                                onClick={() => router.push('/files')}
                                            >
                                                <File className="h-4 w-4" />
                                                {open && (
                                                    <span className="ml-2">
                                                        Files
                                                    </span>
                                                )}
                                            </SidebarMenuButton>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuAction>
                                                    <ChevronRight 
                                                        className={cn(
                                                            'h-4 w-4 transition-transform',
                                                            isFilesOpen &&
                                                                'rotate-90'
                                                        )}
                                                    />
                                                </SidebarMenuAction>
                                            </CollapsibleTrigger>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                    <CollapsibleContent>
                                        <FilesList />
                                    </CollapsibleContent>
                                </Collapsible>

                                <Collapsible
                                    open={isAppsOpen}
                                    onOpenChange={setIsAppsOpen}
                                >
                                    <SidebarMenu>
                                        <SidebarMenuItem className="flex justify-center">
                                            <SidebarMenuButton
                                                className="w-full flex items-center jusitfy-between"
                                                tooltip="Your applications"
                                                onClick={() => router.push('/apps')}
                                            >
                                                <AppWindow className="h-4 w-4" />
                                                {open && (
                                                    <span className="ml-2">
                                                        Apps
                                                    </span>
                                                )}
                                            </SidebarMenuButton>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuAction>
                                                    <ChevronRight 
                                                        className={cn(
                                                            'h-4 w-4 transition-transform',
                                                            isAppsOpen &&
                                                                'rotate-90'
                                                        )}
                                                    />
                                                </SidebarMenuAction>
                                            </CollapsibleTrigger>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                    <CollapsibleContent>
                                        <AppsList />
                                    </CollapsibleContent>
                                </Collapsible>
                            </SidebarGroup>
                        </ScrollArea>
                    </SidebarContent>
                    <SidebarGroup className="mt-auto">
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {!open && (
                                    <SidebarMenuItem className="flex justify-center">
                                        <SidebarMenuButton>
                                            <SidebarTrigger className="w-4 h-4" />
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarFooter>
                        <SidebarMenu>
                            <SidebarMenu>{userProfile}</SidebarMenu>
                        </SidebarMenu>
                    </SidebarFooter>
                    <SidebarRail />
                </Sidebar>
            </SidebarProvider>
        </div>
    )
}


=== ./components/Chat.tsx ===

'use client'

import Chatbar from '@/components/core/chatbar'
import { Message as AIMessage } from '@/components/core/message'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/AuthContext'
import { Message } from 'ai'
import { XCircle } from 'lucide-react'
import React, { useEffect, useRef } from 'react'

interface FileUploadState {
    isUploading: boolean
    progress: number
    error: string | null
}

interface ChatProps {
    messages: Message[]
    isLoading: boolean
    input: string
    onInputChange: (value: string) => void
    onSubmit: (
        e: React.FormEvent,
        message: string,
        file?: File,
        fileId?: string
    ) => Promise<void>
    fileUploadState: FileUploadState
    errorState: Error | null
    onErrorDismiss: () => void
    onChatFinish: () => void
    onUpdateStreamlit: (code: string) => void
    onCodeClick: (code: string) => void
    isInChatPage: boolean
    onTogglePanel: (panel: string) => void
    chatId?: string
    selectedFileIds?: string[]
    onFileSelect?: (fileIds: string[]) => void
}

function Chat({
    messages = [],
    isLoading = false,
    input = '',
    onInputChange,
    onSubmit,
    fileUploadState = { isUploading: false, progress: 0, error: null },
    errorState = null,
    onErrorDismiss,
    onChatFinish,
    onUpdateStreamlit,
    onCodeClick,
    isInChatPage = false,
    onTogglePanel,
    chatId,
    selectedFileIds = [],
    onFileSelect,
}: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const { isPreviewMode, showAuthPrompt } = useAuth()
    const scrollTimeoutRef = useRef<NodeJS.Timeout>()

    // Auto-scroll when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            // Clear any existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
            // Set new timeout for scroll
            scrollTimeoutRef.current = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
        }
        // Cleanup
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
        }
    }, [messages])

    // Handle submission
    const handleSubmit = async (
        e: React.FormEvent,
        message: string,
        file?: File,
        fileId?: string
    ) => {
        e.preventDefault()
        if ((!message.trim() && !file) || isPreviewMode) {
            if (isPreviewMode) {
                showAuthPrompt()
            }
            return
        }

        try {
            await onSubmit(e, message, file, fileId)
            onChatFinish?.()
        } catch (error) {
            console.error('Error submitting message:', error)
        }
    }

    // Handle code click with Streamlit update
    const handleCodeClick = (code: string) => {
        onCodeClick?.(code)
        onUpdateStreamlit?.(code)
    }

    return (
        <div className="flex flex-col relative z-20 text-black h-full">
            {/* Error displays */}
            {errorState && (
                <Alert
                    variant="destructive"
                    className="mb-4 absolute top-0 left-0 right-0 z-50"
                    onClick={onErrorDismiss}
                >
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{errorState.message}</AlertDescription>
                </Alert>
            )}

            {fileUploadState.error && (
                <Alert
                    variant="destructive"
                    className="mb-4 absolute top-0 left-0 right-0 z-50"
                >
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{fileUploadState.error}</AlertDescription>
                </Alert>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 space-y-4 w-full max-w-[800px] m-auto pb-[120px]">
                {Array.isArray(messages) &&
                    messages.map((message, index) => {
                        // Determine if this is the first message in a group of assistant messages
                        const prevMessage = index > 0 ? messages[index - 1] : null;
                        const showAvatar = message.role === 'assistant' && 
                            (!prevMessage || prevMessage.role === 'user' || prevMessage.role === 'system');

                        return (
                            <AIMessage
                                key={`${message.id}-${index}`}
                                {...message}
                                data={message.data as { type: string; actions?: any[] }}
                                isLastMessage={index === messages.length - 1}
                                isLoading={isLoading}
                                onCodeClick={handleCodeClick}
                                onTogglePanel={() => onTogglePanel('right')}
                                onInputChange={onInputChange}
                                showAvatar={showAvatar}
                            />
                        );
                    })}
                <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Chatbar with absolute positioning */}
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-dark-app">
                <Chatbar
                    value={input}
                    onChange={onInputChange}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    fileUploadState={fileUploadState}
                    isInChatPage={isInChatPage}
                    chatId={chatId}
                    selectedFileIds={selectedFileIds}
                    onFileSelect={onFileSelect}
                />
            </div>
        </div>
    )
}

export default React.memo(Chat)


=== ./components/FileCard.tsx ===

import { Card } from "@/components/ui/card";
import { FileIcon, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileCardProps {
  name: string;
  type: string;
  updatedAt: string;
  onClick?: () => void;
}

export function FileCard({ name, type, updatedAt, onClick }: FileCardProps) {
  return (
    <Card 
      className="p-4 hover:shadow-lg transition-shadow cursor-pointer bg-card"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <FileIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-sm truncate max-w-[180px]">{name}</h3>
            <p className="text-xs text-muted-foreground">{type}</p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Open</DropdownMenuItem>
            <DropdownMenuItem>Share</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="mt-4">
        <p className="text-xs text-muted-foreground">
          Updated {updatedAt}
        </p>
      </div>
    </Card>
  );
} 

=== ./components/FileSelector.tsx ===

import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, truncate } from '@/lib/utils'
import { Files, Sheet } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'

interface File {
    id: string
    file_name: string
    file_type: string
    created_at: string
}

interface FileSelectorProps {
    onFileSelect: (fileIds: string[]) => void
    selectedFileIds?: string[]
    chatId?: string
    className?: string
}

export function FileSelector({
    onFileSelect,
    selectedFileIds = [],
    className,
}: FileSelectorProps) {
    const { session, showAuthPrompt } = useAuth()
    const [files, setFiles] = useState<File[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(selectedFileIds)
    )
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        setSelectedIds(new Set(selectedFileIds))
    }, [selectedFileIds])

    useEffect(() => {
        const fetchFiles = async () => {
            if (!isOpen && selectedFileIds.length === 0) return
            if (!session) return
            setIsLoading(true)
            try {
                const response = await fetch('/api/files')
                if (!response.ok) throw new Error('Failed to fetch files')
                const data = await response.json()
                setFiles(data)
            } catch (error) {
                console.error('Error fetching files:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchFiles()
    }, [isOpen, selectedFileIds.length, session])

    const handleFileClick = (fileId: string) => {
        const newSelectedIds = new Set(selectedIds)
        if (newSelectedIds.has(fileId)) {
            newSelectedIds.delete(fileId)
        } else {
            newSelectedIds.add(fileId)
        }
        setSelectedIds(newSelectedIds)
        onFileSelect(Array.from(newSelectedIds))
    }

    const LoadingSkeleton = () => (
        <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1.5">
                    <Skeleton className="h-4 w-[120px]" />
                    <Skeleton className="h-4 w-[60px]" />
                </div>
            ))}
        </div>
    )

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'h-9 w-9 bg-secondary dark:bg-dark-app dark:text-dark-text dark:hover:bg-dark-border relative',
                        className
                    )}
                >
                    <Files className="h-5 w-5" />
                    {session && selectedIds.size > 0 && (
                        <div className="absolute -top-1 -right-1 bg-green-500 dark:bg-[#03f241] text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">
                            {selectedIds.size}
                        </div>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0"
                align="end"
                sideOffset={5}
            >
                <div className="px-4 py-2 border-b">
                    <h4 className="font-medium">Your Data</h4>
                </div>
                <ScrollArea className="h-[300px]">
                    <div className="p-4">
                        {!session ? (
                            <>
                                <div className="mb-4">
                                    <div 
                                        onClick={showAuthPrompt}
                                        className="w-full px-2 py-1.5 rounded-md text-sm bg-secondary/50 hover:bg-secondary cursor-pointer flex items-center gap-2"
                                    >
                                        <Sheet className="h-4 w-4 text-green-600" />
                                        <span>Connect Google Sheets</span>
                                    </div>
                                </div>
                                <div className="text-center py-4">
                                    <p className="text-sm text-muted-foreground mb-2">
                                        Login to connect your data
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="w-full px-2 py-1.5 rounded-md text-sm opacity-60 cursor-not-allowed bg-muted/50 flex items-center gap-2">
                                                    <Sheet className="h-4 w-4 text-green-600" />
                                                    <span>Add Google Sheets</span>
                                                    <span className="ml-auto text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                        Coming Soon!
                                                    </span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="left">
                                                <p className="text-sm">
                                                    Google Sheets integration coming soon!
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>

                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                    Local Files
                                </div>

                                {isLoading ? (
                                    <LoadingSkeleton />
                                ) : files.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No files available
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {files.map((file) => (
                                            <button
                                                key={file.id}
                                                onClick={() =>
                                                    handleFileClick(file.id)
                                                }
                                                className={cn(
                                                    'w-full text-left px-2 py-1.5 rounded-md text-sm',
                                                    'hover:bg-secondary/50 transition-colors',
                                                    'flex items-center justify-between',
                                                    selectedIds.has(file.id) &&
                                                        'bg-green-100 dark:bg-[#03f241]/10 hover:bg-green-100 dark:hover:bg-[#03f241]/10 text-green-900 dark:text-[#03f241]'
                                                )}
                                            >
                                                <span className="truncate">
                                                    {truncate(file.file_name)}
                                                </span>
                                                <span className={cn(
                                                    "text-xs ml-2",
                                                    selectedIds.has(file.id)
                                                        ? 'text-green-700 dark:text-[#03f241]/70'
                                                        : 'text-muted-foreground'
                                                )}>
                                                    {new Date(
                                                        file.created_at
                                                    ).toLocaleDateString()}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}

=== ./components/VersionSelector.tsx ===

'use client'

import { getVersionHistory, switchVersion } from '@/lib/supabase'
import { AppVersion } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import { Button } from './ui/button'

interface VersionSelectorProps {
    appId: string
    onVersionChange: (version: AppVersion) => void
}

export interface VersionSelectorRef {
    refreshVersions: () => void
}

export const VersionSelector = forwardRef<
    VersionSelectorRef,
    VersionSelectorProps
>(function VersionSelector({ appId, onVersionChange }, ref) {
    const [versions, setVersions] = useState<AppVersion[]>([])
    const [currentIndex, setCurrentIndex] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(false)
    const hasInitializedRef = useRef(false)

    const loadVersions = useCallback(async () => {
        if (!appId || isLoading) return

        setIsLoading(true)
        try {
            const versionsData = await getVersionHistory(appId)
            setVersions(versionsData)

            if (versionsData.length > 0) {
                setCurrentIndex(0)

                if (!hasInitializedRef.current) {
                    onVersionChange(versionsData[0])
                    hasInitializedRef.current = true
                }
            }
        } catch (error) {
            console.error('Failed to fetch versions:', error)
        } finally {
            setIsLoading(false)
        }
    }, [appId, onVersionChange, isLoading])

    useImperativeHandle(
        ref,
        () => ({
            refreshVersions: () => {
                hasInitializedRef.current = false
                return loadVersions()
            },
        }),
        [loadVersions]
    )

    useEffect(() => {
        if (appId && !hasInitializedRef.current) {
            loadVersions()
        }
    }, [appId, loadVersions])

    const handleVersionChange = async (newIndex: number) => {
        if (!appId || newIndex < 0 || newIndex >= versions.length || isLoading)
            return

        setIsLoading(true)
        try {
            const selectedVersion = versions[newIndex]
            await switchVersion(appId, selectedVersion.id)

            setCurrentIndex(newIndex)
            setVersions((prev) =>
                prev.map((v, idx) => ({
                    ...v,
                    is_current: idx === newIndex,
                }))
            )

            onVersionChange(selectedVersion)
        } catch (error) {
            console.error('Failed to switch version:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const navigateVersion = (direction: 'prev' | 'next') => {
        const newIndex =
            direction === 'prev' ? currentIndex + 1 : currentIndex - 1
        handleVersionChange(newIndex)
    }

    useEffect(() => {
        console.log('VersionSelector state:', {
            appId,
            versionsCount: versions.length,
            currentIndex,
            isLoading,
            hasInitialized: hasInitializedRef.current,
        })
    }, [
        appId,
        versions.length,
        currentIndex,
        isLoading,
        hasInitializedRef.current,
    ])

    if (versions.length === 0 && !isLoading) return null

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateVersion('prev')}
                disabled={isLoading || currentIndex === versions.length - 1}
                className={cn(
                    'h-9 w-9',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    'text-neutral-700 dark:text-neutral-200',
                    'transition-all duration-200'
                )}
            >
                <ChevronLeft className="h-5 w-5" />
            </Button>

            <div
                className={cn(
                    'flex items-center justify-center min-w-[120px] px-3 py-1.5 rounded-md',
                    'bg-neutral-100/80 dark:bg-neutral-800/80',
                    'border border-neutral-200 dark:border-neutral-700',
                    'backdrop-blur-sm'
                )}
            >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {isLoading ? (
                        'Loading...'
                    ) : versions.length > 0 ? (
                        <>
                            Version {versions[currentIndex]?.version_number}
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-1">
                                / {versions.length}
                            </span>
                        </>
                    ) : (
                        'No versions'
                    )}
                </span>
            </div>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateVersion('next')}
                disabled={isLoading || currentIndex === 0}
                className={cn(
                    'h-9 w-9',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    'text-neutral-700 dark:text-neutral-200',
                    'transition-all duration-200'
                )}
            >
                <ChevronRight className="h-5 w-5" />
            </Button>
        </div>
    )
})

VersionSelector.displayName = 'VersionSelector'


=== ./components/LoadingCards.tsx ===

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="p-4 bg-card">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-4 w-[120px] mb-2" />
                <Skeleton className="h-3 w-[180px]" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-3 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
} 

=== ./components/CodeView.tsx ===

import { Card, CardContent } from '@/components/ui/card'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
    BundledLanguage,
    createHighlighter,
    enableDeprecationWarnings,
} from 'shiki'

enableDeprecationWarnings()

interface CodeViewProps {
    code: string | { code: string }
    isGeneratingCode: boolean
    language?: BundledLanguage
    className?: string
    containerClassName?: string
}

const CODE_THEMES = {
    dark: {
        primary: 'github-dark-high-contrast',
        alternate: 'github-dark-default',
        extra: 'ayu-dark',
    },
    light: {
        primary: 'github-light',
    },
} as const

export function CodeView({
    code,
    isGeneratingCode,
    language = 'python',
    className = '',
    containerClassName = '',
}: CodeViewProps) {
    const [displayCode, setDisplayCode] = useState('')
    const [highlightedHtml, setHighlightedHtml] = useState('')
    const codeRef = useRef('')
    const containerRef = useRef<HTMLDivElement>(null)

    // Initialize Shiki highlighter with dual themes
    useEffect(() => {
        const initHighlighter = async () => {
            const allThemes = [
                ...Object.values(CODE_THEMES.dark),
                ...Object.values(CODE_THEMES.light),
            ]

            const highlighter = await createHighlighter({
                langs: [language],
                themes: allThemes,
            })

            if (displayCode) {
                const html = highlighter.codeToHtml(displayCode, {
                    lang: language,
                    themes: {
                        light: CODE_THEMES.light.primary,
                        dark: CODE_THEMES.dark.primary,
                    },
                })
                setHighlightedHtml(html)
            }
        }

        initHighlighter()
    }, [displayCode, language])

    // Handle streaming code updates
    useEffect(() => {
        if (code) {
            const newCode =
                typeof code === 'object' && 'code' in code
                    ? code.code
                    : String(code)

            codeRef.current = newCode
            setDisplayCode(newCode)

            // Auto-scroll to bottom
            if (containerRef.current) {
                containerRef.current.scrollTop =
                    containerRef.current.scrollHeight
            }
        }
    }, [code])

    return (
        <Card
            className={`bg-bg border-border h-full overflow-hidden ${containerClassName}`}
        >
            <CardContent className="p-0 h-full overflow-hidden">
                <div
                    ref={containerRef}
                    className={`h-full overflow-y-auto font-mono text-sm ${className}`}
                >
                    <div
                        className="min-w-max relative shiki-container overflow-x-auto p-4"
                        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                    />

                    <AnimatePresence>
                        {isGeneratingCode && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/10 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg"
                            >
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-sm font-medium">
                                    Generating code...
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isGeneratingCode && (
                        <motion.div
                            className="absolute bottom-0 right-0 w-2 h-4 bg-primary/50"
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: 'linear',
                            }}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    )
}


=== ./components/StreamlitPreview.tsx ===

import { Card, CardContent } from '@/components/ui/card'
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'

interface StreamlitPreviewProps {
    url: string | null
    isGeneratingCode: boolean
}

export interface StreamlitPreviewRef {
    refreshIframe: () => void
}

export const StreamlitPreview = forwardRef<
    StreamlitPreviewRef,
    StreamlitPreviewProps
>(({ url }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const retryTimeoutRef = useRef<NodeJS.Timeout>()
    const previousUrlRef = useRef<string | null>(null)

    // Function to refresh iframe
    const refreshIframe = () => {
        if (iframeRef.current) {
            iframeRef.current.src = iframeRef.current.src
        }
    }

    // Expose refreshIframe method through ref
    useImperativeHandle(ref, () => ({
        refreshIframe,
    }))

    const content = useMemo(() => {
        if (!url) {
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Nothing to show.</p>
                </div>
            )
        }

        return (
            <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                allow="camera"
            />
        )
    }, [url])

    return (
        <Card className="bg-background h-full">
            <CardContent className="p-0 h-full">{content}</CardContent>
        </Card>
    )
})

StreamlitPreview.displayName = 'StreamlitPreview'


=== ./.prettierrc.json ===

{
    "plugins": ["prettier-plugin-organize-imports"],
    "trailingComma": "es5",
    "tabWidth": 4,
    "semi": false,
    "singleQuote": true
}


=== ./package.json ===

{
    "name": "pyapps",
    "version": "0.1.0",
    "private": true,
    "scripts": {
        "dev": "next dev --turbo",
        "build": "next build",
        "start": "next start",
        "lint": "next lint",
        "format": "prettier --write .",
        "dev:perf": "DEBUG=tools:performance,tools:metrics next dev",
        "test:s3": "node scripts/test-s3-mount.js",
        "dev:debug": "DEBUG=tools:* next dev"
    },
    "dependencies": {
        "@ai-sdk/anthropic": "^1.0.5",
        "@anthropic-ai/sdk": "^0.27.1",
        "@aws-sdk/client-s3": "^3.705.0",
        "@aws-sdk/s3-request-presigner": "^3.515.0",
        "@opentelemetry/api": "1.7.0",
        "@opentelemetry/api-logs": "^0.46.0",
        "@opentelemetry/core": "^1.29.0",
        "@opentelemetry/instrumentation": "^0.46.0",
        "@opentelemetry/resources": "^1.29.0",
        "@opentelemetry/sdk-logs": "^0.56.0",
        "@radix-ui/react-alert-dialog": "^1.1.2",
        "@radix-ui/react-avatar": "^1.1.0",
        "@radix-ui/react-collapsible": "^1.1.1",
        "@radix-ui/react-dialog": "^1.1.1",
        "@radix-ui/react-dropdown-menu": "^2.1.1",
        "@radix-ui/react-hover-card": "^1.1.3",
        "@radix-ui/react-label": "^2.1.0",
        "@radix-ui/react-popover": "^1.1.2",
        "@radix-ui/react-scroll-area": "^1.1.0",
        "@radix-ui/react-select": "^2.1.2",
        "@radix-ui/react-separator": "^1.1.0",
        "@radix-ui/react-slot": "^1.1.0",
        "@radix-ui/react-tabs": "^1.1.0",
        "@radix-ui/react-tooltip": "^1.1.2",
        "@supabase/auth-helpers-nextjs": "^0.10.0",
        "@supabase/ssr": "^0.5.2",
        "@supabase/supabase-js": "^2.45.3",
        "@tanstack/react-query": "^5.59.19",
        "@types/lodash": "^4.17.14",
        "@types/papaparse": "^5.3.14",
        "ai": "^4.1.0",
        "aws-sdk": "^2.1692.0",
        "class-variance-authority": "^0.7.0",
        "clsx": "^2.1.1",
        "debug": "^4.3.7",
        "e2b": "^0.16.2",
        "framer-motion": "^11.5.4",
        "gpt-tokenizer": "^2.5.1",
        "jsonwebtoken": "^9.0.2",
        "lodash": "^4.17.21",
        "lottie-react": "^2.4.0",
        "lucide-react": "^0.436.0",
        "motion": "^11.13.1",
        "next": "^15.0.4",
        "next-themes": "^0.4.4",
        "papaparse": "^5.4.1",
        "prismjs": "^1.29.0",
        "react": "18.2.0",
        "react-dom": "18.2.0",
        "react-dropzone": "^14.2.3",
        "react-intersection-observer": "^9.15.0",
        "react-markdown": "^9.0.1",
        "react-resizable-panels": "^2.1.6",
        "react-simple-code-editor": "^0.14.1",
        "react-syntax-highlighter": "^15.6.1",
        "recharts": "^2.12.7",
        "rehype-prism-plus": "^2.0.0",
        "rehype-raw": "^7.0.0",
        "rehype-stringify": "^10.0.1",
        "remark-gfm": "^4.0.0",
        "remark-parse": "^11.0.0",
        "remark-rehype": "^11.1.1",
        "tailwind-merge": "^2.5.2",
        "tailwindcss-animate": "^1.0.7",
        "unified": "^11.0.5",
        "usehooks-ts": "^3.1.0",
        "uuid": "^11.0.3",
        "zod": "^3.23.8",
        "zustand": "^5.0.1"
    },
    "devDependencies": {
        "@types/debug": "^4.1.12",
        "@types/jsonwebtoken": "^9.0.6",
        "@types/node": "^20",
        "@types/prismjs": "^1.26.4",
        "@types/react": "^18.3.11",
        "@types/react-dom": "^18.3.1",
        "@types/react-syntax-highlighter": "^15.5.13",
        "eslint": "^9.16.0",
        "eslint-config-next": "14.2.7",
        "knip": "^5.38.1",
        "postcss": "^8",
        "prettier-plugin-organize-imports": "^3.2.4",
        "shiki": "^1.24.2",
        "tailwindcss": "^3.4.1",
        "typescript": "^5"
    }
}


=== ./scripts/package.json ===

{
    "name": "s3-mount-test",
    "private": true,
    "type": "module",
    "scripts": {
        "test": "node test-s3-mount.ts"
    },
    "dependencies": {
        "@aws-sdk/client-s3": "^3.515.0",
        "@aws-sdk/s3-request-presigner": "^3.515.0",
        "dotenv": "^16.4.5",
        "e2b": "^0.16.2"
    },
    "devDependencies": {
        "@types/node": "^20.11.24",
        "ts-node": "^10.9.2",
        "typescript": "^5.3.3"
    }
}


=== ./scripts/test-s3-mount.js ===

import { Sandbox } from 'e2b'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Constants
const E2B_COST_PER_SECOND = 0.000028 // 2 vCPUs cost/second
const REPORT_FILE = 's3_performance_report.txt'
const TEST_FILE_CONTENT = `This is a test file for S3FS performance testing.
It includes multiple lines of text to simulate a real document.
We'll use this for read/write performance testing.
The file contains various lengths of content to test different scenarios.
${'-'.repeat(1000)}\n`.repeat(10) // Creates a sizable test file

class PerformanceReport {
    constructor() {
        this.startTime = Date.now()
        this.operations = []
        this.content = []
        this.errors = []
    }

    addLine(text = '') {
        this.content.push(text)
    }

    addError(error) {
        this.errors.push(error.toString())
    }

    addOperation(name, duration, cost, startUsage, endUsage, details = {}) {
        this.operations.push({
            name,
            duration,
            cost,
            startUsage,
            endUsage,
            ...details,
        })
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        if (bytes === 0) return '0 Byte'
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i]
    }

    async write() {
        const totalDuration = (Date.now() - this.startTime) / 1000
        const totalCost = totalDuration * E2B_COST_PER_SECOND

        const report = [
            '='.repeat(100),
            'S3FS Performance Test Report'.padStart(65),
            '='.repeat(100),
            '',
            `Generated: ${new Date().toISOString()}`,
            `Test Duration: ${totalDuration.toFixed(2)} seconds`,
            '',
            '-'.repeat(100),
            'Cost Analysis'.padStart(60),
            '-'.repeat(100),
            `Current Test Cost:        $${totalCost.toFixed(6)}`,
            `Hourly Cost:             $${(E2B_COST_PER_SECOND * 3600).toFixed(6)}`,
            `Daily Cost (24h):        $${(E2B_COST_PER_SECOND * 3600 * 24).toFixed(4)}`,
            `Monthly Cost (30d):      $${(E2B_COST_PER_SECOND * 3600 * 24 * 30).toFixed(2)}`,
            '',
            '-'.repeat(100),
            'Performance Tests'.padStart(63),
            '-'.repeat(100),
            '',
            ...this.operations
                .map((op) => [
                    `Test: ${op.name}`,
                    `Duration:          ${op.duration.toFixed(2)}s`,
                    `Cost:             $${op.cost.toFixed(6)}`,
                    `Transfer Rate:     ${op.bytesPerSecond ? this.formatBytes(op.bytesPerSecond) + '/s' : 'N/A'}`,
                    '',
                    'Resource Usage Before:',
                    op.startUsage,
                    '',
                    'Resource Usage After:',
                    op.endUsage,
                    '',
                    Object.entries(op)
                        .filter(
                            ([key]) =>
                                ![
                                    'name',
                                    'duration',
                                    'cost',
                                    'startUsage',
                                    'endUsage',
                                    'bytesPerSecond',
                                ].includes(key)
                        )
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\n'),
                    '',
                    '-'.repeat(50),
                    '',
                ])
                .flat(),
            '',
            this.content.length
                ? [
                      '-'.repeat(100),
                      'Additional Information'.padStart(65),
                      '-'.repeat(100),
                      ...this.content,
                      '',
                  ].flat()
                : [],
            this.errors.length
                ? [
                      '-'.repeat(100),
                      'Errors'.padStart(57),
                      '-'.repeat(100),
                      ...this.errors,
                      '',
                  ].flat()
                : [],
            '='.repeat(100),
            'End of Report'.padStart(60),
            '='.repeat(100),
        ].flat()

        await fs.writeFile(REPORT_FILE, report.join('\n'))
        console.log(`\nDetailed report written to ${REPORT_FILE}`)
    }
}

async function getAWSCredentials() {
    try {
        const credentialsPath = join(homedir(), '.aws', 'credentials')
        const configPath = join(homedir(), '.aws', 'config')

        const credentials = await fs.readFile(credentialsPath, 'utf8')
        const config = await fs.readFile(configPath, 'utf8')

        const accessKeyMatch = credentials.match(/aws_access_key_id\s*=\s*(.+)/)
        const secretKeyMatch = credentials.match(
            /aws_secret_access_key\s*=\s*(.+)/
        )
        const regionMatch = config.match(/region\s*=\s*(.+)/)

        if (!accessKeyMatch || !secretKeyMatch) {
            throw new Error('Missing AWS credentials')
        }

        return {
            accessKeyId: accessKeyMatch[1].trim(),
            secretAccessKey: secretKeyMatch[1].trim(),
            region: regionMatch?.[1]?.trim() || 'us-east-1',
        }
    } catch (error) {
        console.error('Failed to read AWS credentials:', error)
        process.exit(1)
    }
}

async function getResourceUsage(sandbox) {
    const result = await sandbox.process.start({
        cmd: `
            echo "Memory Usage:"
            free -h
            echo -e "\nCPU Usage:"
            top -b -n 1 | head -n 5
            echo -e "\nS3FS Process:"
            ps aux | grep s3fs | grep -v grep
        `,
    })
    return result.stdout
}

async function testS3Performance() {
    const report = new PerformanceReport()
    console.log('🚀 Starting S3 performance test...')

    const creds = await getAWSCredentials()
    const sandbox = await Sandbox.create({
        apiKey:
            process.env.E2B_API_KEY ||
            'e2b_45ff57d2cbb35f978d452964b459efad92e97c61',
        template: 'streamlit-sandbox-s3',
    })

    report.addLine(`Sandbox ID: ${sandbox.id}`)
    report.addLine(`Region: ${creds.region}`)
    report.addLine()

    try {
        // Mount S3
        await sandbox.process.start({
            cmd: `
                echo "${creds.accessKeyId}:${creds.secretAccessKey}" | sudo tee /etc/passwd-s3fs > /dev/null &&
                sudo chmod 600 /etc/passwd-s3fs &&
                sudo s3fs pyapps /app/s3 -o passwd_file=/etc/passwd-s3fs -o url="https://s3.amazonaws.com" \
                -o endpoint=${creds.region} -o allow_other -o umask=0000 -o use_path_request_style &
                sleep 2
            `,
        })

        // Verify mount
        const mountCheck = await sandbox.process.start({
            cmd: 'mountpoint -q /app/s3 && echo "✅ S3 mounted" || echo "❌ S3 not mounted"',
        })
        report.addLine('Mount Status: ' + mountCheck.stdout)

        // Performance tests
        const tests = [
            {
                name: 'Write 1MB Random Data',
                cmd: 'dd if=/dev/urandom of=/app/s3/test_1mb.bin bs=1M count=1 status=progress',
                size: 1024 * 1024,
            },
            {
                name: 'Write 10MB Random Data',
                cmd: 'dd if=/dev/urandom of=/app/s3/test_10mb.bin bs=1M count=10 status=progress',
                size: 10 * 1024 * 1024,
            },
            {
                name: 'Write Large Text File',
                prepare: async () => {
                    await sandbox.process.start({
                        cmd: `echo '${TEST_FILE_CONTENT}' > /app/s3/test_file.txt`,
                    })
                },
            },
            {
                name: 'Read 1MB File',
                cmd: 'dd if=/app/s3/test_1mb.bin of=/dev/null bs=1M status=progress',
                size: 1024 * 1024,
            },
            {
                name: 'Read 10MB File',
                cmd: 'dd if=/app/s3/test_10mb.bin of=/dev/null bs=1M status=progress',
                size: 10 * 1024 * 1024,
            },
            {
                name: 'Create 100 Small Files',
                cmd: `for i in {1..100}; do echo "test content $i" > "/app/s3/test_$i.txt"; done`,
                size: 100 * 20, // Approximate size of each file
            },
            {
                name: 'Read 100 Small Files',
                cmd: `for i in {1..100}; do cat "/app/s3/test_$i.txt" > /dev/null; done`,
                size: 100 * 20,
            },
        ]

        for (const test of tests) {
            const start = Date.now()
            const startUsage = await getResourceUsage(sandbox)

            if (test.prepare) {
                await test.prepare()
            }

            if (test.cmd) {
                await sandbox.process.start({
                    cmd: test.cmd,
                    onStderr: console.error,
                })
            }

            const endUsage = await getResourceUsage(sandbox)
            const duration = (Date.now() - start) / 1000
            const cost = duration * E2B_COST_PER_SECOND
            const bytesPerSecond = test.size ? test.size / duration : undefined

            report.addOperation(
                test.name,
                duration,
                cost,
                startUsage,
                endUsage,
                {
                    bytesPerSecond,
                }
            )
        }

        // Memory stress test
        const start = Date.now()
        const startUsage = await getResourceUsage(sandbox)

        await sandbox.process.start({
            cmd: `
                echo "Starting memory stress test..."
                for i in {1..50}; do
                    dd if=/dev/urandom of=/app/s3/stress_$i.bin bs=1M count=2 2>/dev/null &
                done
                wait
                echo "Memory stress test complete"
                free -h
            `,
            onStdout: (data) => report.addLine(data),
        })

        const endUsage = await getResourceUsage(sandbox)
        const duration = (Date.now() - start) / 1000
        const cost = duration * E2B_COST_PER_SECOND

        report.addOperation(
            'Memory Stress Test (100MB parallel writes)',
            duration,
            cost,
            startUsage,
            endUsage
        )

        // Cleanup
        await sandbox.process.start({
            cmd: 'rm -rf /app/s3/test_* /app/s3/stress_*',
        })
    } catch (error) {
        report.addError(error)
        console.error('Error during tests:', error)
    } finally {
        await sandbox.close()
        await report.write()
    }
}

console.log('Starting S3FS performance test suite...')
testS3Performance().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
})


=== ./lib/schema.ts ===

import { z } from 'zod'

export const ExecutionResultSchema = z.object({
    status: z.enum(['success', 'error']),
    output: z.string().optional(),
    error: z.string().optional(),
})

export const AppSchema = z.object({
    title: z.string().describe('Short title of the app. Max 3 words.'),
    description: z
        .string()
        .describe('Short description of what the app does. Max 1 sentence.'),
    // type: z.enum(['web', 'api', 'cli', 'mobile']).describe('Type of application being generated'),
    //   template: z.string().describe('Name of the template used to generate the app.'),
    file_path: z.string().describe('Relative path to the main file'),
    code: z.string().describe('Generated runnable code'),
    additional_dependencies: z
        .array(z.string())
        .describe('Additional dependencies required by the app'),
    has_additional_dependencies: z
        .boolean()
        .describe('Whether additional dependencies are required'),
    install_dependencies_command: z
        .string()
        .describe('Command to install additional dependencies'),
})

export const MessageContentSchema = z.object({
    type: z.enum(['text', 'code']),
    content: z.string(),
    app: AppSchema.optional(),
})

export const MessageSchema = z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.array(MessageContentSchema),
    createdAt: z.date(),
    object: AppSchema.optional(),
    result: ExecutionResultSchema.optional(),
})

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>
export type App = z.infer<typeof AppSchema>
export type MessageContent = z.infer<typeof MessageContentSchema>
export type ChatMessage = z.infer<typeof MessageSchema>


=== ./lib/tools/streamlit.ts ===

import { Sandbox } from 'e2b'
import { tool } from 'ai'
import { z } from 'zod'
import { setupS3Mount } from '@/lib/s3'
import { getUser } from '@/lib/supabase/server'

const streamlitToolSchema = z.object({
    code: z
        .string()
        .describe(
            'Complete, runnable Streamlit app code including all necessary imports. If the user has data, code should use the path "/app/s3/data/<filenamewithextension>" to read the data.'
        ),
    requiredLibraries: z
        .array(z.string())
        .describe(
            'List of Python package dependencies required to run the Streamlit app'
        ),
    appName: z
        .string()
        .describe('Descriptive name for the Streamlit application'),
    appDescription: z
        .string()
        .max(200, 'Keep description concise')
        .describe("Brief summary of the app's functionality and purpose"),
})

type StreamlitToolInput = z.infer<typeof streamlitToolSchema>
type StreamlitToolOutput = { errors: string }

export const streamlitTool = tool<typeof streamlitToolSchema, StreamlitToolOutput>({
    parameters: streamlitToolSchema,
    execute: async ({
        code,
        requiredLibraries,
        appName,
        appDescription,
    }: StreamlitToolInput) => {
        try {
            const user = await getUser()
            if (!user) {
                throw new Error('User not authenticated')
            }

            const sandbox = await Sandbox.create({
                template: 'streamlit-sandbox-s3'
            })
            
            await setupS3Mount(sandbox, user.id)
            
            await sandbox.filesystem.makeDir('/app')
            await sandbox.filesystem.write('/app/test.py', code)

            // Run with streamlit in headless mode to check for errors
            const execution = await sandbox.process.startAndWait({
                cmd: 'python /app/test.py',
            })

            // Get all output
            const fullOutput = execution.stdout + execution.stderr
            
            // Extract only traceback and subsequent content
            const tracebackMatch = fullOutput.match(/Traceback \(most recent call last\):[\s\S]*$/m)
            const errors = tracebackMatch ? tracebackMatch[0] : 'No errors found!'

            await sandbox.close()

            return { errors }
        } catch (error) {
            console.error('Sandbox execution error:', error)
            throw error
        }
    },
})

=== ./lib/s3.ts ===

import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import Sandbox, { Process, ProcessMessage } from 'e2b'

export const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
})

export const BUCKET_NAME = process.env.AWS_S3_BUCKET!
export const CHUNK_SIZE = 4 * 1024 * 1024 // 5MB chunks for multipart upload

export async function uploadToS3(
    file: Buffer,
    key: string,
    contentType: string
) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: contentType,
    })

    await s3Client.send(command)
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

export async function getSignedDownloadUrl(key: string) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    })

    return await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
}

export async function deleteFromS3(key: string) {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    })

    await s3Client.send(command)
}

export function getUserFileKey(
    userId: string,
    fileId: string,
    fileName: string
): string {
    return `${userId}/files/${fileId}/${fileName}`
}

export function getUserAppKey(
    userId: string,
    appId: string,
    version: string
): string {
    return `${userId}/apps/${appId}/code/app_v${version}.py`
}

export async function getFileFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    })

    const response = await s3Client.send(command)
    const byteArray = await response.Body!.transformToByteArray()
    return Buffer.concat([Buffer.from(byteArray)])
}

export const getS3Key = (userId: string, fileName: string): string => {
    return `${userId}/data/${fileName}`
}

export async function setupS3Mount(sandbox: Sandbox, userId: string) {
    // Ensure directory exists
    await sandbox.process.start({
        cmd: 'sudo mkdir -p /app/s3',
    })

    // Write credentials file
    await sandbox.process.start({
        cmd: `echo "${process.env.AWS_ACCESS_KEY_ID}:${process.env.AWS_SECRET_ACCESS_KEY}" | sudo tee /etc/passwd-s3fs > /dev/null && sudo chmod 600 /etc/passwd-s3fs`,
    })

    // Mount S3 with debug output
    await sandbox.process.start({
        cmd: `sudo s3fs "pyapps:/${userId}" /app/s3 \
            -o passwd_file=/etc/passwd-s3fs \
            -o url="https://s3.amazonaws.com" \
            -o endpoint=${process.env.AWS_REGION} \
            -o allow_other \
            -o umask=0000 \
            -o dbglevel=info \
            -o use_path_request_style \
            -o default_acl=private \
            -o use_cache=/tmp`,
        onStdout: (output: ProcessMessage) => {
            console.log('Mount stdout:', output.line)
        },
        onStderr: (output: ProcessMessage) => {
            console.error('Mount stderr:', output.line)
        },
    })

    // Verify mount
    const verifyMount = (await sandbox.process.start({
        cmd: 'df -h | grep s3fs || echo "not mounted"',
    })) as Process & { text: string }

    if (verifyMount.text?.includes('not mounted')) {
        throw new Error('Failed to verify S3 mount')
    }
}

export async function initiateMultipartUpload(key: string, contentType: string) {
    const command = new CreateMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    })

    const { UploadId } = await s3Client.send(command)
    return UploadId
}

export async function uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer
) {
    const command = new UploadPartCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
    })

    const response = await s3Client.send(command)
    return {
        PartNumber: partNumber,
        ETag: response.ETag,
    }
}

export async function completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[]
) {
    const command = new CompleteMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
            Parts: parts,
        },
    })

    await s3Client.send(command)
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

export async function abortMultipartUpload(key: string, uploadId: string) {
    const command = new AbortMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
    })

    await s3Client.send(command)
}


=== ./lib/models.json ===

{
    "models": [
        {
            "id": "claude-3-5-sonnet-20241022",
            "provider": "Anthropic",
            "providerId": "anthropic",
            "name": "Claude 3.5 Sonnet",
            "multiModal": true
        }
    ]
}


=== ./lib/utils.ts ===

import {
    CoreMessage,
    CoreToolMessage,
    generateId,
    Message,
    ToolInvocation,
} from 'ai'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { v4 as uuidv4 } from 'uuid'
import { Database } from './database.types'

export interface User {
    id: string
    email: string
    created_at: string
    updated_at: string
}

export interface Chat {
    id: string
    user_id: string
    title: string
    created_at: string
    updated_at: string
    messages: Array<Message>
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface ApplicationError extends Error {
    info: string
    status: number
}

export const fetcher = async (url: string) => {
    const res = await fetch(url)

    if (!res.ok) {
        const error = new Error(
            'An error occurred while fetching the data.'
        ) as ApplicationError

        error.info = await res.json()
        error.status = res.status

        throw error
    }

    return res.json()
}

export function getLocalStorage(key: string) {
    if (typeof window !== 'undefined') {
        return JSON.parse(localStorage.getItem(key) || '[]')
    }
    return []
}

export function generateUUID(): string {
    return uuidv4()
}
function addToolMessageToChat({
    toolMessage,
    messages,
}: {
    toolMessage: CoreToolMessage
    messages: Array<Message>
}): Array<Message> {
    return messages.map((message) => {
        if (message.toolInvocations) {
            return {
                ...message,
                toolInvocations: message.toolInvocations.map(
                    (toolInvocation) => {
                        const toolResult = toolMessage.content.find(
                            (tool) =>
                                tool.toolCallId === toolInvocation.toolCallId
                        )

                        if (toolResult) {
                            return {
                                ...toolInvocation,
                                state: 'result',
                                result: toolResult.result,
                            }
                        }

                        return toolInvocation
                    }
                ),
            }
        }

        return message
    })
}

export function convertToUIMessages(
    messages: Array<CoreMessage>
): Array<Message> {
    return messages.reduce((chatMessages: Array<Message>, message) => {
        if (message.role === 'tool') {
            return addToolMessageToChat({
                toolMessage: message as CoreToolMessage,
                messages: chatMessages,
            })
        }

        let textContent = ''
        let toolInvocations: Array<ToolInvocation> = []

        if (typeof message.content === 'string') {
            textContent = message.content
        } else if (Array.isArray(message.content)) {
            for (const content of message.content) {
                if (content.type === 'text') {
                    textContent += content.text
                } else if (content.type === 'tool-call') {
                    toolInvocations.push({
                        state: 'call',
                        toolCallId: content.toolCallId,
                        toolName: content.toolName,
                        args: content.args,
                    })
                }
            }
        }

        chatMessages.push({
            id: generateId(),
            role: message.role,
            content: textContent,
            toolInvocations,
        })

        return chatMessages
    }, [])
}

export function getTitleFromChat(chat: Chat) {
    const messages = convertToUIMessages(chat.messages as Array<CoreMessage>)
    const firstMessage = messages[0]

    if (!firstMessage) {
        return 'Untitled'
    }

    return firstMessage.content
}

export const truncate = (str: string) => {
    const maxLength = 30 // Adjust this value as needed
    if (str.length <= maxLength) return str
    const extension = str.slice(str.lastIndexOf('.'))
    const nameWithoutExtension = str.slice(0, str.lastIndexOf('.'))
    const truncatedName = nameWithoutExtension.slice(
        0,
        maxLength - 3 - extension.length
    )
    return `${truncatedName}...${extension}`
}

type DatabaseMessage = Database['public']['Tables']['messages']['Row']

export function formatDatabaseMessages(
    dbMessages: DatabaseMessage[]
): Message[] {
    return dbMessages
        .map((msg) => {
            const messages: Message[] = []

            // Add user message if exists
            if (msg.user_message) {
                messages.push({
                    id: `${msg.id}-user`,
                    role: 'user',
                    content: msg.user_message,
                    createdAt: new Date(msg.created_at),
                })
            }

            // Add assistant message if exists
            if (msg.assistant_message) {
                const toolInvocations: ToolInvocation[] = []

                // Process tool calls and results together
                if (msg.tool_calls) {
                    const calls = (
                        Array.isArray(msg.tool_calls)
                            ? msg.tool_calls
                            : [msg.tool_calls]
                    ) as any[]
                    const results = msg.tool_results
                        ? ((Array.isArray(msg.tool_results)
                              ? msg.tool_results
                              : [msg.tool_results]) as any[])
                        : []

                    for (const call of calls) {
                        const result = results.find(
                            (r: { tool_call_id: any }) =>
                                r?.tool_call_id === call?.id
                        )

                        const toolInvocation: ToolInvocation = {
                            toolCallId: call?.toolCallId,
                            toolName: call?.toolName,
                            state: result
                                ? ('result' as const)
                                : ('call' as const),
                            args: call?.args,
                            ...(result && {
                                result: {
                                    code: result?.code,
                                    appName:
                                        result?.appName || 'No name generated',
                                    appDescription:
                                        result?.appDescription ||
                                        'No description generated',
                                },
                            }),
                        } as ToolInvocation

                        toolInvocations.push(toolInvocation)
                    }
                }

                messages.push({
                    id: `${msg.id}-assistant`,
                    role: 'assistant',
                    content: msg.assistant_message,
                    createdAt: new Date(msg.created_at),
                    toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
                    data: msg.data ? {
                        type: (msg.data as any).type,
                        actions: (msg.data as any).actions
                    } : undefined,
                })
            }

            return messages
        })
        .flat()
}


=== ./lib/stores/sandbox-store.ts ===

import { create } from 'zustand'

interface SandboxState {
    // Execution state
    sandboxId: string | null
    isInitializing: boolean
    lastExecutedCode: string | null
    error: string | null

    // UI state
    streamlitUrl: string | null
    isLoadingSandbox: boolean
    isGeneratingCode: boolean
    generatedCode: string

    // Methods
    updateSandbox: (
        code: string,
        forceExecute?: boolean,
        appId?: string
    ) => Promise<string | null>
    killSandbox: () => Promise<void>
    clearError: () => void
    setGeneratingCode: (isGenerating: boolean) => void
    setStreamlitUrl: (url: string | null) => void
    setIsLoadingSandbox: (loading: boolean) => void
    setGeneratedCode: (code: string) => void
}

// Add helper functions at the top
const getSessionId = () => {
    if (typeof window === 'undefined') return null
    let sessionId = sessionStorage.getItem('sandbox_session_id')
    if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2, 15)
        sessionStorage.setItem('sandbox_session_id', sessionId)
    }
    return sessionId
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
    // Execution state
    sandboxId: null,
    isInitializing: false,
    lastExecutedCode: null,
    error: null,

    // UI state
    streamlitUrl: null,
    isLoadingSandbox: false,
    isGeneratingCode: false,
    generatedCode: '',

    // Methods
    setGeneratingCode: (isGenerating) =>
        set({ isGeneratingCode: isGenerating }),

    updateSandbox: async (
        code: string,
        forceExecute: boolean = false,
        appId?: string
    ) => {
        const { sandboxId, lastExecutedCode } = get()
        const sessionId = getSessionId()

        if (!forceExecute && code === lastExecutedCode) {
            return get().streamlitUrl
        }

        set({
            isInitializing: true,
            error: null,
            isLoadingSandbox: true,
        })

        try {
            const response = await fetch(
                `/api/sandbox/${sandboxId || 'new'}/execute`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Id': sessionId || '',
                        ...(appId && { 'X-App-Id': appId }),
                    },
                    body: JSON.stringify({ code }),
                }
            )

            if (!response.ok) {
                throw new Error('Failed to execute code')
            }

            const data = await response.json()
            set({
                lastExecutedCode: code,
                sandboxId: data.sandboxId,
                streamlitUrl: data.url,
                isInitializing: false,
                isGeneratingCode: false,
                error: null,
            })
            return data.url
        } catch (error) {
            set({
                error: 'Failed to update sandbox',
                isInitializing: false,
                isLoadingSandbox: false,
                isGeneratingCode: false,
            })
            return null
        }
    },

    killSandbox: async () => {
        const { sandboxId } = get()
        const sessionId = getSessionId()

        if (sandboxId) {
            try {
                set({ error: null })
                await fetch(`/api/sandbox/${sandboxId}/kill`, {
                    method: 'POST',
                    headers: {
                        'X-Session-Id': sessionId || '',
                    },
                })
                set({
                    sandboxId: null,
                    streamlitUrl: null,
                    lastExecutedCode: null,
                    isLoadingSandbox: false,
                    isGeneratingCode: false,
                })
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : 'Failed to kill sandbox'
                set({ error: errorMessage })
                console.error('Error killing sandbox:', error)
            }
        }
    },

    clearError: () => set({ error: null }),

    setStreamlitUrl: (url) => set({ streamlitUrl: url }),
    setIsLoadingSandbox: (loading) => set({ isLoadingSandbox: loading }),
    setGeneratedCode: (code) => set({ generatedCode: code }),
}))


=== ./lib/supabase/client.ts ===

'use client'

import { Database } from '@/lib/database.types'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}


=== ./lib/supabase/server.ts ===

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '../database.types'

export const createClient = async () => {
    const cookieStore = await cookies()

    return createServerClient<Database>(
        // Pass Supabase URL and anonymous key from the environment to the client
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,

        // Define a cookies object with methods for interacting with the cookie store and pass it to the client
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                },
            },
        }
    )
}

export async function getUser() {
    const supabase = await createClient()
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
}


=== ./lib/prompts.ts ===

export const CHAT_SYSTEM_PROMPT = `You assist users in developing complex, aesthetic Streamlit apps and doing data analysis and visualization within the Streamlit framework. Your response format:
1. Structure responses outside of tools with clear Markdown formatting
2. Have a human-like tone, be VERY concise and to the point
3. Go above and beyond to write code that is error-free
4. Only use plotly for data visualization
5. When working with files, write Python code using EXACT column names and pay close attention to the data types and sample data.
6. When an API key or secret is required, add an input bar for the user to enter the API key or secret.
7. Use streamlit-extras in your code wherever applicable. Do not use metric cards from extras as they are not compatible with dark mode.
8. st.experimental_rerun() wil throw an error. Use st.rerun() instead.
9. When the user pastes an error message, fix the error and rewrite the code, but PLEASE keep other functionality intact.
10. If while running coding you get a module not found error, inform the user and ask if ok to move ahead without the module and offer alternative.
`

export const CHAT_TITLE_PROMPT = `You are an AI assistant responsible for generating concise and relevant chat titles based on conversations. Follow these guidelines:
1. The title should be 4-6 words long and reflect the key themes or topics discussed.
2. Use both the user message and assistant message as context to determine the most important subject matter.
3. Avoid generic terms like 'Chat' or 'Conversation.'
4. Ensure the title is descriptive and helps users easily identify the conversation content.`


=== ./lib/types.ts ===

import { Json } from '@/lib/database.types'
import { App, ExecutionResult } from '@/lib/schema'
import { Message } from 'ai'
import { z } from 'zod'

// Model types
export interface ModelProvider {
    id: string
    streamText: (params: StreamParams) => Promise<void>
}

export interface AppVersion {
    id: string
    version_id?: string
    app_id: string
    code: string
    version_number: number
    name: string | null
    description: string | null
    created_at: string
    // Optional fields to maintain compatibility
    updated_at?: string
    is_current?: boolean
}

export interface StreamParams {
    messages: Message[]
    tools?: Tool[]
    stream?: boolean
    onToken: (token: string) => void
    onToolCall?: (toolInvocation: ToolInvocation) => Promise<void>
}

// Tool types aligned with Vercel AI SDK
export interface ToolCallPayload {
    id: string
    name: string
    parameters: Record<string, any>
}

export interface ToolResultPayload {
    id: string
    name: string
    content: string
}

// Message types aligned with Vercel AI SDK
export interface ClientMessage {
    id: string
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    createdAt: Date
    toolInvocations?: ToolInvocation[]
}

// Database message type
export interface DatabaseMessage {
    id: string
    user_id: string
    chat_id: string
    role: 'system' | 'user' | 'assistant' | 'tool'
    user_message: string
    assistant_message: string
    tool_calls: ToolCall[] | Json
    tool_results: Json | null
    data: Json | null
    token_count: number
    created_at: string
}

// Tool definition aligned with Vercel AI SDK
export interface Tool {
    toolName: string
    description: string
    parameters: z.ZodObject<any>
    execute?: (args: Record<string, any>) => Promise<any>
    streamExecution?: (
        args: Record<string, any>,
        signal?: AbortSignal
    ) => AsyncGenerator<ToolStreamResponse>
}

// Add StreamingTool interface
export interface StreamingTool extends Tool {
    streamExecution: (
        args: Record<string, any>,
        signal?: AbortSignal
    ) => AsyncGenerator<ToolStreamResponse>
}

// Add ToolStreamResponse type
export type ToolStreamResponse =
    | {
          type: 'tool-call-streaming-start'
          toolCallId: string
          toolName: string
      }
    | {
          type: 'tool-call-delta'
          toolCallId: string
          argsTextDelta: string
      }
    | {
          type: 'tool-result'
          toolCallId: string
          result: any
      }

// Model configuration
export interface LLMModelConfig {
    model: string
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
}

// Add this to your types.ts
export type LLMModel = {
    id: string
    name: string
    provider: string
    providerId: string
}

export interface ToolInvocation {
    state: 'call' | 'result'
    toolCallId: string
    toolName: string
    args: Record<string, any>
    result?: any
}

export interface ToolCall {
    id: string
    name: string
    parameters: any
}

export interface FileContext {
    id: string
    fileName: string
    fileType: 'csv' | 'json' | 'txt'
    content?: string
    analysis: any
}

// Add this to your existing types
export const RequestSchema = z.object({
    messages: z.array(
        z.object({
            content: z.string(),
            role: z.enum(['user', 'assistant', 'system']),
            createdAt: z.date().optional(),
        })
    ),
    model: z.object({
        id: z.string(),
        provider: z.string(),
        providerId: z.string(),
        name: z.string(),
    }),
    config: z.object({
        model: z.string(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
    }),
    fileId: z.string().optional(),
    fileName: z.string().optional(),
    fileContent: z.string().optional(),
})

export type RequestSchemaType = z.infer<typeof RequestSchema>

export interface VersionMetadata {
    version_id: string
    version_number: number
    app_id: string
    created_at: string
}

export interface CustomMessage extends Message {
    object?: App
    result?: ExecutionResult
    isCodeVisible?: boolean
    steps?: Array<{
        type: string
        finishReason?: string
        [key: string]: any
    }>
}

export interface FileData {
    id: string
    name: string
    type: string
    updated_at: string
    size?: number
    user_id?: string
}

export interface AppData {
    id: string
    name: string
    description: string | null
    updated_at: string
    is_public: boolean
    public_id: string | null
    current_version_id: string | null
    created_at: string
}


=== ./lib/csvAnalyzer.ts ===

import { parse } from 'papaparse'

export interface CSVColumn {
    name: string
    type: string
}

export interface CSVAnalysis {
    columns: CSVColumn[]
    totalRows: number
    sampleRows: string[][]
}

export async function analyzeCSV(csvContent: string): Promise<CSVAnalysis> {
    return new Promise((resolve, reject) => {
        parse(csvContent, {
            complete: (results) => {
                const data = results.data as string[][]
                const headers = data[0]
                const rows = data.slice(1)
                const sampleSize = Math.min(2000, rows.length)
                const sampleRows = rows.slice(0, sampleSize)

                // Filter out rows that are empty or contain only null/empty values
                const nonNullRows = sampleRows.filter((row) =>
                    row.some((cell) => cell != null && cell.trim() !== '')
                )

                const analysis: CSVAnalysis = {
                    totalRows: rows.length,
                    columns: headers.map((header, index) => ({
                        name: header,
                        type: inferColumnType(
                            sampleRows.map((row) => row[index])
                        ),
                    })),
                    sampleRows: nonNullRows.slice(0, 10), // Take first 10 non-null rows
                }

                resolve(analysis)
            },
            error: (error: any) => {
                reject(error)
            },
        })
    })
}

function inferColumnType(values: string[]): string {
    const sampleSize = Math.min(1000, values.length)
    const sample = values.slice(0, sampleSize)

    const isNumeric = sample.every(
        (value) => !isNaN(Number(value)) && value.trim() !== ''
    )
    const isBoolean = sample.every((value) =>
        ['true', 'false', '0', '1'].includes(value.toLowerCase())
    )
    const isDate = sample.every((value) => !isNaN(Date.parse(value)))

    if (isBoolean) return 'boolean'
    if (isNumeric) return 'number'
    if (isDate) return 'date'
    return 'string'
}


=== ./lib/database.types.ts ===

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            files: {
                Row: {
                    id: string
                    user_id: string
                    file_name: string
                    file_type: string
                    file_size: number
                    s3_key: string
                    analysis: Json | null
                    expires_at: string | null
                    created_at: string
                    updated_at: string
                    last_accessed: string
                    upload_id: string | null
                    upload_status: 'pending' | 'uploading' | 'completed' | 'failed'
                    uploaded_chunks: number | null
                    total_chunks: number | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    file_name: string
                    file_type: string
                    file_size: number
                    s3_key: string
                    analysis?: Json | null
                    expires_at?: string | null
                    created_at?: string
                    updated_at?: string
                    last_accessed?: string
                    upload_id?: string | null
                    upload_status?: 'pending' | 'uploading' | 'completed' | 'failed'
                    uploaded_chunks?: number | null
                    total_chunks?: number | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    file_name?: string
                    file_type?: string
                    file_size?: number
                    s3_key?: string
                    analysis?: Json | null
                    expires_at?: string | null
                    created_at?: string
                    updated_at?: string
                    last_accessed?: string
                    upload_id?: string | null
                    upload_status?: 'pending' | 'uploading' | 'completed' | 'failed'
                    uploaded_chunks?: number | null
                    total_chunks?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: 'files_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            apps: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    description: string | null
                    is_public: boolean
                    public_id: string | null
                    current_version_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    description?: string | null
                    is_public?: boolean
                    public_id?: string | null
                    current_version_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    description?: string | null
                    is_public?: boolean
                    public_id?: string | null
                    current_version_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'apps_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'apps_current_version_id_fkey'
                        columns: ['current_version_id']
                        referencedRelation: 'app_versions'
                        referencedColumns: ['id']
                    },
                ]
            }
            app_versions: {
                Row: {
                    id: string
                    app_id: string
                    version_number: number
                    code: string
                    name: string | null
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    app_id: string
                    version_number: number
                    code: string
                    name?: string | null
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    app_id?: string
                    version_number?: number
                    code?: string
                    name?: string | null
                    description?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'app_versions_app_id_fkey'
                        columns: ['app_id']
                        referencedRelation: 'apps'
                        referencedColumns: ['id']
                    },
                ]
            }
            chats: {
                Row: {
                    id: string
                    user_id: string
                    app_id: string | null
                    name: string | null
                    messages: {
                        id: string
                        role: 'system' | 'user' | 'assistant' | 'data'
                        content: string
                        createdAt?: string
                        name?: string
                        data?: Json
                        annotations?: Json[]
                        toolInvocations?: {
                            state: 'call' | 'partial-call' | 'result'
                            toolCallId: string
                            toolName: string
                            args?: Json
                            result?: Json
                        }[]
                        experimental_attachments?: Json[]
                    }[] | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    app_id?: string | null
                    name?: string | null
                    messages?: {
                        id: string
                        role: 'system' | 'user' | 'assistant' | 'data'
                        content: string
                        createdAt?: string
                        name?: string
                        data?: Json
                        annotations?: Json[]
                        toolInvocations?: {
                            state: 'call' | 'partial-call' | 'result'
                            toolCallId: string
                            toolName: string
                            args?: Json
                            result?: Json
                        }[]
                        experimental_attachments?: Json[]
                    }[] | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    app_id?: string | null
                    name?: string | null
                    messages?: {
                        id: string
                        role: 'system' | 'user' | 'assistant' | 'data'
                        content: string
                        createdAt?: string
                        name?: string
                        data?: Json
                        annotations?: Json[]
                        toolInvocations?: {
                            state: 'call' | 'partial-call' | 'result'
                            toolCallId: string
                            toolName: string
                            args?: Json
                            result?: Json
                        }[]
                        experimental_attachments?: Json[]
                    }[] | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'chats_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'chats_app_id_fkey'
                        columns: ['app_id']
                        referencedRelation: 'apps'
                        referencedColumns: ['id']
                    },
                ]
            }
            messages: {
                Row: {
                    id: string
                    chat_id: string
                    user_id: string
                    user_message: string
                    assistant_message: string
                    tool_calls: Json | null
                    tool_results: Json | null
                    token_count: number
                    data: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    chat_id: string
                    user_id: string
                    user_message: string
                    assistant_message: string
                    tool_calls?: Json | null
                    tool_results?: Json | null
                    token_count: number
                    data?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    chat_id?: string
                    user_id?: string
                    user_message?: string
                    assistant_message?: string
                    tool_calls?: Json | null
                    tool_results?: Json | null
                    token_count?: number
                    data?: Json | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'messages_chat_id_fkey'
                        columns: ['chat_id']
                        referencedRelation: 'chats'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'messages_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            chat_files: {
                Row: {
                    id: string
                    chat_id: string
                    file_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    chat_id: string
                    file_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    chat_id?: string
                    file_id?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'chat_files_chat_id_fkey'
                        columns: ['chat_id']
                        referencedRelation: 'chats'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'chat_files_file_id_fkey'
                        columns: ['file_id']
                        referencedRelation: 'files'
                        referencedColumns: ['id']
                    },
                ]
            }
            usage_limits: {
                Row: {
                    id: string
                    user_id: string
                    chat_tokens_used: number
                    chat_tokens_limit: number
                    files_uploaded: number
                    files_upload_limit: number
                    storage_used: number
                    storage_limit: number
                    reset_date: string | null
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    chat_tokens_used?: number
                    chat_tokens_limit: number
                    files_uploaded?: number
                    files_upload_limit: number
                    storage_used?: number
                    storage_limit: number
                    reset_date?: string | null
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    chat_tokens_used?: number
                    chat_tokens_limit?: number
                    files_uploaded?: number
                    files_upload_limit?: number
                    storage_used?: number
                    storage_limit?: number
                    reset_date?: string | null
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'usage_limits_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            users: {
                Row: {
                    id: string
                    full_name: string | null
                    avatar_url: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    avatar_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    avatar_url?: string | null
                    created_at?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            initialize_usage_limits: {
                Args: Record<PropertyKey, never>
                Returns: undefined
            }
            update_app_public_status: {
                Args: {
                    p_app_id: string
                    p_version_id: string
                    v_public_id: string
                }
                Returns: Json
            }
            get_expired_files: {
                Args: {
                    cutoff_date?: string
                }
                Returns: {
                    id: string
                    file_name: string
                    expires_at: string
                }[]
            }
            insert_message: {
                Args: {
                    p_chat_id: string
                    p_user_id: string
                    p_user_message: string
                    p_assistant_message: string
                    p_token_count: number
                    p_tool_calls?: Json
                    p_tool_results?: Json
                }
                Returns: string
            }
            get_chat_messages: {
                Args: {
                    p_chat_id: string
                    p_limit?: number
                    p_offset?: number
                }
                Returns: {
                    id: string
                    user_id: string
                    user_message: string
                    assistant_message: string
                    tool_calls: Json
                    tool_results: Json
                    token_count: number
                    created_at: string
                }[]
            }
            get_latest_messages_by_chat: {
                Args: {
                    p_user_id: string
                    p_limit?: number
                }
                Returns: {
                    chat_id: string
                    message_id: string
                    user_message: string
                    assistant_message: string
                    created_at: string
                }[]
            }
            get_user_total_tokens: {
                Args: {
                    p_user_id: string
                }
                Returns: number
            }
            create_app_version: {
                Args: {
                    p_app_id: string
                    p_code: string
                    p_name?: string | null
                    p_description?: string | null
                }
                Returns: {
                    version_id: string
                    version_number: number
                    app_id: string
                    name: string | null
                    description: string | null
                    created_at: string
                }
            }
            switch_app_version: {
                Args: {
                    p_app_id: string
                    p_version_id: string
                }
                Returns: {
                    success: boolean
                    app_id: string
                    version_id: string
                    switched_at: string
                }
            }
            get_app_versions: {
                Args: {
                    p_app_id: string
                }
                Returns: {
                    id: string
                    version_number: number
                    code: string
                    name: string | null
                    description: string | null
                    created_at: string
                    is_current: boolean
                }[]
            }
            handle_streamlit_tool_response: {
                Args: {
                    p_user_id: string
                    p_chat_id: string
                    p_code: string
                    p_app_name: string
                    p_app_description: string
                }
                Returns: {
                    app_id: string
                    version_id: string
                    version_number: number
                    created_at: string
                    is_update: boolean
                    name: string
                    description: string | null
                }
            }
            get_chat_current_app_version: {
                Args: {
                    p_chat_id: string
                }
                Returns: {
                    version_id: string
                    app_id: string
                    code: string
                    version_number: number
                    name: string | null
                    description: string | null
                    created_at: string
                } | null
            }
            delete_chat_and_related: {
                Args: {
                    p_chat_id: string
                    p_user_id: string
                }
                Returns: {
                    chat_files_associations: number
                    messages: number
                    app_versions: number
                    apps: number
                    chat: number
                }
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}


=== ./lib/fileAnalyzer.ts ===

import Papa from 'papaparse'

export interface AnalysisOptions {
    sampleSize?: number
    maxRows?: number
}

type ColumnType = 'number' | 'boolean' | 'date' | 'string' | 'mixed' | 'null'

interface ColumnStats {
    values: Set<any>
    types: Map<ColumnType, number>
    nullCount: number
    numbers: {
        min?: number
        max?: number
        sum: number
        count: number
    }
}

export interface CSVAnalysis {
    metadata: {
        rows: number
        columns: number
        size_bytes: number
        has_header: boolean
    }
    column_info: {
        name: string
        type: ColumnType
        sample_values: any[]
        numeric_stats?: {
            min: number
            max: number
        }
    }[]
}

export async function analyzeCSV(
    content: string,
    options: AnalysisOptions = {}
): Promise<CSVAnalysis> {
    const SAMPLE_SIZE = options.sampleSize || 100
    const columnStats = new Map<string, ColumnStats>()
    let rowCount = 0
    let headerRow: string[] = []

    function inferType(value: any): ColumnType {
        if (value === null || value === undefined || value === '') return 'null'

        // Fast path for primitive types
        if (typeof value === 'number') return 'number'
        if (typeof value === 'boolean') return 'boolean'

        if (typeof value === 'string') {
            const trimmed = value.trim()

            // Number check
            if (/^-?\d*\.?\d+$/.test(trimmed)) return 'number'

            // Boolean check
            if (/^(true|false)$/i.test(trimmed)) return 'boolean'

            // Date check - only common formats for performance
            if (
                /^\d{4}-\d{2}-\d{2}/.test(trimmed) || // ISO date
                /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(trimmed)
            ) {
                // Common date formats
                return 'date'
            }
        }

        return 'string'
    }

    function updateColumnStats(column: string, value: any) {
        let stats = columnStats.get(column)

        if (!stats) {
            stats = {
                values: new Set(),
                types: new Map(),
                nullCount: 0,
                numbers: {
                    sum: 0,
                    count: 0,
                },
            }
            columnStats.set(column, stats)
        }

        const type = inferType(value)
        stats.types.set(type, (stats.types.get(type) || 0) + 1)

        if (type === 'null') {
            stats.nullCount++
            return
        }

        if (stats.values.size < SAMPLE_SIZE) {
            stats.values.add(value)
        }

        // Handle numeric values
        const numValue =
            type === 'number'
                ? typeof value === 'number'
                    ? value
                    : parseFloat(value)
                : NaN

        if (!isNaN(numValue)) {
            stats.numbers.count++
            stats.numbers.sum += numValue
            if (
                stats.numbers.min === undefined ||
                numValue < stats.numbers.min
            ) {
                stats.numbers.min = numValue
            }
            if (
                stats.numbers.max === undefined ||
                numValue > stats.numbers.max
            ) {
                stats.numbers.max = numValue
            }
        }
    }

    function getPrimaryType(types: Map<ColumnType, number>): ColumnType {
        const entries = Array.from(types.entries())
            .filter(([type]) => type !== 'null')
            .sort((a, b) => b[1] - a[1])

        if (entries.length === 0) return 'null'
        if (entries.length === 1) return entries[0][0]

        const [primaryType, primaryCount] = entries[0]
        const total = Array.from(types.values()).reduce((a, b) => a + b, 0)

        return primaryCount / total > 0.7 ? primaryType : 'mixed'
    }

    return new Promise((resolve) => {
        Papa.parse(content.trim(), {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            fastMode: true,
            chunk: ({ data, meta }: { data: any[]; meta: any }) => {
                if (rowCount === 0 && meta.fields) {
                    headerRow = meta.fields
                }

                rowCount += data.length

                data.forEach((row) => {
                    headerRow.forEach((column) => {
                        updateColumnStats(column, row[column])
                    })
                })
            },
            complete: () => {
                const analysis: CSVAnalysis = {
                    metadata: {
                        rows: rowCount,
                        columns: headerRow.length,
                        size_bytes: content.length,
                        has_header: true,
                    },
                    column_info: headerRow.map((column) => {
                        const stats = columnStats.get(column)!
                        return {
                            name: column,
                            type: getPrimaryType(stats.types),
                            sample_values: Array.from(stats.values)
                                .filter(
                                    (value) =>
                                        value !== null &&
                                        value !== undefined &&
                                        value !== ''
                                )
                                .slice(0, 5),
                            ...(stats.numbers.count > 0 && {
                                numeric_stats: {
                                    min: stats.numbers.min!,
                                    max: stats.numbers.max!,
                                },
                            }),
                        }
                    }),
                }
                resolve(analysis)
            },
        })
    })
}


=== ./lib/supabase.ts ===

import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { AppVersion, VersionMetadata } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Version management functions
export async function createVersion(
    appId: string,
    code: string
): Promise<VersionMetadata> {
    try {
        if (!appId || !code) {
            throw new Error('Missing required parameters')
        }

        // Create version using RPC
        const { data, error } = await supabase.rpc('create_app_version', {
            p_app_id: appId,
            p_code: code,
        })

        if (error) throw error

        // Update app's current_version_id
        const { error: updateError } = await supabase
            .from('apps')
            .update({
                current_version_id: data.version_id,
                updated_at: new Date().toISOString(),
            })
            .eq('id', appId)

        if (updateError) throw updateError

        console.log('Version created and app updated:', data)
        return data
    } catch (error) {
        console.error('Failed to create version:', error)
        throw error
    }
}

export async function switchVersion(
    appId: string,
    versionId: string
): Promise<{ error?: Error }> {
    try {
        const { error: rpcError } = await supabase.rpc('switch_app_version', {
            p_app_id: appId,
            p_version_id: versionId,
        })

        if (rpcError) {
            console.error('Error switching version:', rpcError)
            return { error: rpcError }
        }

        return {}
    } catch (error) {
        console.error('Error in switchVersion:', error)
        return {
            error: error instanceof Error ? error : new Error('Unknown error'),
        }
    }
}

export async function getVersionHistory(appId: string): Promise<AppVersion[]> {
    try {
        console.log('Fetching versions for app:', appId)
        const { data, error } = await supabase
            .from('app_versions')
            .select('*')
            .eq('app_id', appId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching versions:', error)
            throw error
        }

        console.log('Fetched versions:', data)

        // Transform data to include is_current
        if (data && data.length > 0) {
            return data.map((version, index) => ({
                ...version,
                is_current: index === 0, // Mark only the latest version as current
            })) as AppVersion[]
        }

        return []
    } catch (error) {
        console.error('Failed to fetch versions:', error)
        throw error
    }
}

// Custom RPC functions
export async function updateAppPublicStatus(
    appId: string,
    versionId: string,
    publicId: string
) {
    const { data, error } = await supabase.rpc('update_app_public_status', {
        p_app_id: appId,
        p_version_id: versionId,
        v_public_id: publicId,
    })

    if (error) throw error
    return data
}

export async function getExpiredFiles(cutoffDate?: string) {
    const { data, error } = await supabase.rpc('get_expired_files', {
        cutoff_date: cutoffDate,
    })

    if (error) throw error
    return data
}

export async function getLatestMessagesByChat(
    userId: string,
    limit: number = 10
) {
    const { data, error } = await supabase.rpc('get_latest_messages_by_chat', {
        p_user_id: userId,
        p_limit: limit,
    })

    if (error) throw error
    return data
}

export async function getUserTotalTokens(userId: string) {
    const { data, error } = await supabase.rpc('get_user_total_tokens', {
        p_user_id: userId,
    })

    if (error) throw error
    return data
}


=== ./components.json ===

{
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "default",
    "rsc": true,
    "tsx": true,
    "tailwind": {
        "config": "tailwind.config.ts",
        "css": "app/globals.css",
        "baseColor": "neutral",
        "cssVariables": false,
        "prefix": ""
    },
    "aliases": {
        "components": "@/components",
        "utils": "@/lib/utils",
        "ui": "@/components/ui",
        "lib": "@/lib",
        "hooks": "@/hooks"
    }
}


=== ./tsconfig.json ===

{
    "compilerOptions": {
        "lib": ["dom", "dom.iterable", "esnext"],
        "allowJs": true,
        "skipLibCheck": true,
        "strict": true,
        "noEmit": true,
        "esModuleInterop": true,
        "module": "esnext",
        "moduleResolution": "bundler",
        "resolveJsonModule": true,
        "isolatedModules": true,
        "jsx": "preserve",
        "incremental": true,
        "plugins": [
            {
                "name": "next"
            }
        ],
        "paths": {
            "@/*": ["./*"]
        },
        "target": "ES2017"
    },
    "include": [
        "next-env.d.ts",
        "**/*.ts",
        "**/*.tsx",
        ".next/types/**/*.ts",
        "app/api/auth/r.ts"
    ],
    "exclude": ["node_modules"]
}


=== ./.eslintrc.json ===

{
    "extends": "next/core-web-vitals",
    "rules": {
        "react-hooks/exhaustive-deps": "warn",
        "react-hooks/rules-of-hooks": "warn"
    }
}

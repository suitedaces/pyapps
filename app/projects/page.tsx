'use client'

import { Suspense } from 'react'
import { Search, Plus, MessageSquare, Trash2 } from "lucide-react"
import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useInView } from "react-intersection-observer"
import debounce from 'lodash/debounce'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { AuthPrompt } from '@/components/ui/auth-prompt'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppLayout } from "@/components/AppLayout"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
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
} from "@/components/ui/alert-dialog"
import { Database } from '@/lib/database.types'

const ITEMS_PER_PAGE = 20

type AppVersionRow = Database['public']['Tables']['app_versions']['Row']
type FileRow = Database['public']['Tables']['files']['Row']

interface ProjectData {
    id: string
    name: string | null
    description: string | null
    updated_at: string
    app_id: string | null
    files: Array<{
        id: string
        file_name: string
        file_type: string
    }>
    app_name: string | null
    app_description: string | null
    versions: Array<{
        id: string
        version_number: number
        created_at: string
    }>
}

function ProjectsTableSkeleton() {
    return (
        <div className="h-[calc(100vh-3.5rem)] w-full relative">
            <div className="max-w-7xl mx-auto px-4 relative z-50">
                <div className="flex items-center gap-4 py-4">
                    <div className="relative flex-1">
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-28" />
                </div>

                <div className="overflow-y-auto h-[calc(100vh-7.5rem)] rounded-md border border-border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-muted/50">
                                <TableHead className="w-[300px]">Name</TableHead>
                                <TableHead className="w-[250px]">App</TableHead>
                                <TableHead className="w-[150px]">Files</TableHead>
                                <TableHead className="w-[150px]">Last Updated</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i} className="border-border">
                                    <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-8 w-8" />
                                            <Skeleton className="h-8 w-8" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}

function ProjectsContent({ onChatDeleted }: { onChatDeleted: () => void }) {
    const [projects, setProjects] = useState<ProjectData[]>([])
    const [loading, setLoading] = useState(false)
    const [initialLoad, setInitialLoad] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const supabase = createClient()
    const { ref, inView } = useInView()
    const loadingRef = useRef(false)
    const { session, isLoading, isPreviewMode } = useAuth()
    const router = useRouter()

    const fetchProjects = useCallback(async (pageIndex: number, search: string) => {
        if (loadingRef.current || !session?.user?.id) return
        
        try {
            loadingRef.current = true
            setLoading(true)
            
            let query = supabase
                .from('chats')
                .select(`
                    *,
                    apps:app_id (
                        *,
                        app_versions!app_versions_app_id_fkey (*)
                    ),
                    chat_files (
                        files:file_id (*)
                    )
                `, { count: 'exact' })
                .eq('user_id', session.user.id)

            if (search) {
                query = query.ilike('name', `%${search}%`)
            }

            query = query.order('updated_at', { ascending: false })
                .range(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE - 1)

            const { data, error, count } = await query

            if (error) {
                console.error('Error fetching projects:', error.message)
                console.error('Error details:', {
                    message: error.message,
                    hint: error.hint,
                    details: error.details,
                    code: error.code
                })
                setProjects([])
                setHasMore(false)
                setTotalCount(0)
                return
            }

            if (!data) {
                setProjects([])
                setHasMore(false)
                setTotalCount(0)
                return
            }

            const transformedData = data.map((chat: any) => ({
                id: chat.id,
                name: chat.name,
                description: chat.messages?.[0]?.content || null,
                updated_at: chat.updated_at,
                app_id: chat.app_id,
                files: chat.chat_files?.map((cf: any) => cf.files)
                    .filter((f: any): f is FileRow => f !== null)
                    .map((f: FileRow) => ({
                        id: f.id,
                        file_name: f.file_name,
                        file_type: f.file_type
                    })) || [],
                app_name: chat.apps?.name || null,
                app_description: chat.apps?.description || null,
                versions: chat.apps?.app_versions?.map((v: AppVersionRow) => ({
                    id: v.id,
                    version_number: v.version_number,
                    created_at: v.created_at
                })) || []
            }))

            if (pageIndex === 0) {
                setProjects(transformedData)
            } else {
                setProjects(prev => [...prev, ...transformedData])
            }

            if (count !== null) {
                setTotalCount(count)
                setHasMore((pageIndex + 1) * ITEMS_PER_PAGE < count)
            } else {
                setTotalCount(0)
                setHasMore(false)
            }
        } catch (error) {
            console.error('Error in fetchProjects:', error)
            setProjects([])
            setHasMore(false)
            setTotalCount(0)
        } finally {
            loadingRef.current = false
            setLoading(false)
            setInitialLoad(false)
        }
    }, [supabase, session?.user?.id])

    const debouncedSearch = useCallback(
        debounce((search: string) => {
            setPage(0)
            fetchProjects(0, search)
        }, 300),
        [fetchProjects]
    )

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
            fetchProjects(nextPage, searchQuery)
        }
    }, [inView, hasMore, page, fetchProjects, searchQuery])

    useEffect(() => {
        if (session?.user?.id) {
            fetchProjects(0, '')
        }
    }, [fetchProjects, session?.user?.id])

    if (isPreviewMode) {
        return <AuthPrompt canClose={false} />
    }

    if (isLoading || initialLoad) {
        return <ProjectsTableSkeleton />
    }

    if (!session?.user) {
        return <AuthPrompt canClose={false} />
    }

    return (
        <div className="h-[calc(100vh-3.5rem)] w-full relative">
            <div className="max-w-7xl mx-auto px-4 relative z-50">
                <div className="flex items-center gap-4 py-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 h-4 w-4 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 pl-10 bg-transparent text-foreground placeholder:text-foreground/50 outline-none"
                        />
                    </div>
                    <p className="text-sm text-foreground/50">
                        {totalCount} project{totalCount !== 1 ? 's' : ''}
                    </p>
                    <button
                        onClick={() => router.push('/chat')} 
                        className="flex items-center gap-2 text-foreground hover:text-foreground/70 transition-colors"
                    >
                        <Plus size={16} />
                        New Project
                    </button>
                </div>

                <div className="overflow-y-auto h-[calc(100vh-7.5rem)] rounded-md border border-border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-muted/50">
                                <TableHead className="w-[300px]">Name</TableHead>
                                <TableHead className="w-[250px]">App</TableHead>
                                <TableHead className="w-[150px]">Files</TableHead>
                                <TableHead className="w-[150px]">Last Updated</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projects.map((project) => (
                                <TableRow 
                                    key={project.id} 
                                    className="group cursor-pointer border-border hover:bg-muted/50"
                                    onClick={() => router.push(`/projects/${project.id}`)}
                                >
                                    <TableCell className="font-medium">
                                        {project.name || 'Untitled Project'}
                                    </TableCell>
                                    <TableCell>
                                        {project.app_name ? (
                                            <div className="space-y-1.5">
                                                <div className="font-medium text-sm">{project.app_name}</div>
                                                <Badge variant="secondary" size="sm">
                                                    {project.versions.length} version{project.versions.length !== 1 ? 's' : ''}
                                                </Badge>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">No app</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {project.files.length > 0 ? (
                                            <Badge size="sm">
                                                {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">No files</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(project.updated_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    router.push(`/projects/${project.id}`)
                                                }}
                                                className="h-8 w-8"
                                            >
                                                <MessageSquare className="h-4 w-4" />
                                                <span className="sr-only">Open Chat</span>
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="sr-only">Delete Project</span>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="max-w-[400px]">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-xl font-semibold text-foreground">
                                                            Delete Project
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription className="text-muted-foreground/80 pt-2">
                                                            Are you sure you want to delete this project? This action cannot be undone and will permanently delete all associated data.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter className="mt-4 gap-2">
                                                        <AlertDialogCancel className="border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                                            Cancel
                                                        </AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={async (e) => {
                                                                e.stopPropagation()
                                                                try {
                                                                    const response = await fetch(
                                                                        `/api/chats/${project.id}`,
                                                                        {
                                                                            method: 'DELETE',
                                                                        }
                                                                    )

                                                                    if (!response.ok) {
                                                                        const error = await response.json()
                                                                        throw new Error(error.error || 'Failed to delete project')
                                                                    }

                                                                    onChatDeleted()
                                                                    setPage(0)
                                                                    fetchProjects(0, searchQuery)
                                                                } catch (error) {
                                                                    console.error('Failed to delete project:', error)
                                                                    alert('Failed to delete project. Please try again.')
                                                                }
                                                            }}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-red-600 dark:text-white dark:hover:bg-red-700 transition-colors"
                                                        >
                                                            Delete Project
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {projects.length === 0 && !loading && (
                                <TableRow className="border-border">
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <div className="text-muted-foreground">
                                            {searchQuery ? 'No projects found' : 'No projects yet'}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    {loading && !initialLoad && (
                        <div className="flex justify-center py-4">
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                    )}
                    
                    {hasMore && <div ref={ref} className="h-10" />}
                </div>
            </div>
        </div>
    )
}

export default function ProjectsPage() {
    const [chats, setChats] = useState<any[]>([])
    const [chatTitles, setChatTitles] = useState<Record<string, string>>({})
    const [isCreatingChat, setIsCreatingChat] = useState(false)
    const router = useRouter()

    const handleChatDeleted = useCallback(() => {
        const fetchChats = async () => {
            const response = await fetch('/api/chats')
            const data = await response.json()
            setChats(data.chats || [])
        }
        fetchChats()
    }, [])

    useEffect(() => {
        handleChatDeleted()
    }, [handleChatDeleted])

    return (
        <AppLayout
            rightPanel={null}
            showRightPanel={false}
            onToggleRightPanel={() => {}}
            chats={chats}
            chatTitles={chatTitles}
            currentChatId={null}
            isCreatingChat={isCreatingChat}
            onChatSelect={(id) => router.push(`/projects/${id}`)}
            onGenerateTitle={async () => null}
            onChatDeleted={handleChatDeleted}
        >
            <Suspense fallback={<ProjectsTableSkeleton />}>
                <ProjectsContent onChatDeleted={handleChatDeleted} />
            </Suspense>
        </AppLayout>
    )
}

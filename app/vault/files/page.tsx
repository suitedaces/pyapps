// 'use client'

// import { FileText, MoreVertical } from 'lucide-react'
// import { useRouter, useSearchParams } from 'next/navigation'
// import { Suspense, useCallback, useEffect, useState } from 'react'

// import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'

// // Import pagination components
// import AppSidebar from '@/components/Sidebar'
// import {
//     Pagination,
//     PaginationContent,
//     PaginationEllipsis,
//     PaginationItem,
//     PaginationLink,
//     PaginationNext,
//     PaginationPrevious,
// } from '@/components/ui/pagination'
// import { SidebarProvider } from '@/components/ui/sidebar'

// interface File {
//     id: string
//     name: string
//     created_at: string
//     type?: string
//     size?: string
// }

// interface PaginatedResponse {
//     files: File[]
//     total: number
// }

// const ITEMS_PER_PAGE = 15

// function FilesList() {
//     const [files, setFiles] = useState<File[]>([])
//     const [totalFiles, setTotalFiles] = useState(0)
//     const [isLoading, setIsLoading] = useState(true)
//     const [searchQuery, setSearchQuery] = useState('')
//     const [debouncedSearch, setDebouncedSearch] = useState('')
//     const [currentChatId, setCurrentChatId] = useState<string | null>(null)
//     const [isCreatingChat, setIsCreatingChat] = useState(false)

//     const router = useRouter()
//     const searchParams = useSearchParams()
//     const currentPage = Number(searchParams.get('page')) || 1

//     // Debounce search
//     useEffect(() => {
//         const timer = setTimeout(() => {
//             setDebouncedSearch(searchQuery)
//         }, 300)
//         return () => clearTimeout(timer)
//     }, [searchQuery])

//     const handleChatSelect = useCallback(
//         (chatId: string) => {
//             setCurrentChatId(chatId)
//             router.push(`/?chat=${chatId}`)
//         },
//         [router]
//     )

//     const handleNewChat = useCallback(async () => {
//         if (window.location.pathname !== '/') {
//             router.push('/')
//         }
//         return Promise.resolve()
//     }, [router])

//     const handleNewChatClick = () => {
//         router.push('/chat')
//     }

//     // Fetch files with search
//     useEffect(() => {
//         const fetchFiles = async () => {
//             try {
//                 setIsLoading(true)
//                 const response = await fetch(
//                     `/api/files?page=${currentPage}&limit=${ITEMS_PER_PAGE}&search=${debouncedSearch}`
//                 )
//                 if (!response.ok) throw new Error('Failed to fetch files')
//                 const data: PaginatedResponse = await response.json()
//                 setFiles(data.files)
//                 setTotalFiles(data.total)
//             } catch (error) {
//                 console.error('Error fetching files:', error)
//             } finally {
//                 setIsLoading(false)
//             }
//         }

//         fetchFiles()
//     }, [currentPage, debouncedSearch])

//     const totalPages = Math.ceil(totalFiles / ITEMS_PER_PAGE)

//     const createPageURL = (pageNumber: number | string) => {
//         const params = new URLSearchParams(searchParams)
//         params.set('page', pageNumber.toString())
//         return `?${params.toString()}`
//     }

//     const handleTabChange = (value: string) => {
//         if (value === 'chats') {
//             router.push('/vault/chat')
//         }
//     }

//     return (
//         <SidebarProvider>
//             <AppSidebar
//                 onChatSelect={handleChatSelect}
//                 onNewChat={handleNewChat}
//                 currentChatId={currentChatId}
//                 chats={[]}
//                 isCreatingChat={isCreatingChat}
//             />
//             <div className="p-7 h-screen w-full bg-bg">
//                 <div className="flex flex-col h-full w-full border-2 border-border bg-white overflow-hidden">
//                     <div className="border-b border-gray-500 pt-5">
//                         <div className="container flex gap-5 mx-auto px-4">
//                             <h3 className="text-3xl font-semibold text-gray-800 py-2 mb-2">
//                                 Vault
//                             </h3>
//                             <Tabs
//                                 defaultValue="files"
//                                 className="w-full"
//                                 onValueChange={handleTabChange}
//                             >
//                                 <TabsList className="grid w-[400px] grid-cols-2 bg-gray-100">
//                                     <TabsTrigger
//                                         value="chats"
//                                         className="data-[state=active]:bg-white"
//                                     >
//                                         Chats
//                                     </TabsTrigger>
//                                     <TabsTrigger
//                                         value="files"
//                                         className="data-[state=active]:bg-white"
//                                     >
//                                         Files
//                                     </TabsTrigger>
//                                 </TabsList>
//                             </Tabs>
//                         </div>
//                     </div>

//                     <div className="container mx-auto px-4 py-4">
//                         <Input
//                             placeholder="Search for a file..."
//                             className="w-full bg-white border-gray-300 focus:border-gray-400 focus:ring-gray-400"
//                             value={searchQuery}
//                             onChange={(e) => setSearchQuery(e.target.value)}
//                         />
//                     </div>

//                     <div className="flex-1 overflow-hidden flex flex-col">
//                         <div className="flex-1 overflow-y-auto">
//                             <div className="container mx-auto px-4">
//                                 <div className="space-y-2 pb-4">
//                                     {isLoading ? (
//                                         // Loading skeleton
//                                         Array.from({ length: 5 }).map(
//                                             (_, index) => (
//                                                 <div
//                                                     key={index}
//                                                     className="flex items-start gap-4 p-4 rounded-lg bg-[#F4F4F4] border border-gray-200 animate-pulse"
//                                                 >
//                                                     <div className="flex-shrink-0">
//                                                         <div className="h-8 w-8 bg-bg rounded" />
//                                                     </div>
//                                                     <div className="flex-1">
//                                                         <div className="h-4 w-1/4 bg-bg rounded mb-2" />
//                                                         <div className="h-3 w-3/4 bg-bg rounded" />
//                                                     </div>
//                                                 </div>
//                                             )
//                                         )
//                                     ) : Array.isArray(files) &&
//                                       files.length > 0 ? (
//                                         files.map((file) => (
//                                             <div
//                                                 key={file.id}
//                                                 className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-100 cursor-pointer border border-gray-500 transition-colors"
//                                             >
//                                                 <div className="flex-shrink-0">
//                                                     <FileText className="h-8 w-8 text-gray-400" />
//                                                 </div>
//                                                 <div className="flex-1 min-w-0">
//                                                     <div className="flex items-center justify-between">
//                                                         <h3 className="text-sm font-medium text-gray-800 truncate">
//                                                             {file.name}
//                                                         </h3>
//                                                         <div className="flex items-center gap-2">
//                                                             <span className="text-xs text-gray-500">
//                                                                 {new Date(
//                                                                     file.created_at
//                                                                 ).toLocaleDateString()}
//                                                             </span>
//                                                             <Button
//                                                                 variant="ghost"
//                                                                 size="icon"
//                                                                 className="h-8 w-8 hover:bg-gray-100"
//                                                             >
//                                                                 <MoreVertical className="h-4 w-4 text-gray-500" />
//                                                             </Button>
//                                                         </div>
//                                                     </div>
//                                                     <p className="text-sm text-gray-500">
//                                                         {file.type} •{' '}
//                                                         {file.size}
//                                                     </p>
//                                                 </div>
//                                             </div>
//                                         ))
//                                     ) : (
//                                         <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)]">
//                                             <div className="h-12 w-12 bg-[#E5E6E9] rounded-full flex items-center justify-center mb-4">
//                                                 <FileText className="h-6 w-6 text-gray-500" />
//                                             </div>
//                                             <h3 className="text-lg font-semibold text-gray-900 mb-1">
//                                                 No Files Created
//                                             </h3>
//                                             <Button
//                                                 variant="outline"
//                                                 className="mt-4 bg-white hover:bg-gray-50 border-gray-300"
//                                                 onClick={handleNewChatClick}
//                                             >
//                                                 New Chat
//                                             </Button>
//                                         </div>
//                                     )}
//                                 </div>
//                             </div>
//                         </div>

//                         {totalPages > 1 && (
//                             <div className="border-t border-gray-500 py-4 bg-white mt-auto">
//                                 <div className="container mx-auto px-4">
//                                     <Pagination>
//                                         <PaginationContent className="flex justify-center">
//                                             <PaginationItem>
//                                                 <PaginationPrevious
//                                                     href={createPageURL(
//                                                         currentPage - 1
//                                                     )}
//                                                     className={`transition-opacity ${currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}`}
//                                                 />
//                                             </PaginationItem>

//                                             {[...Array(totalPages)].map(
//                                                 (_, i) => {
//                                                     const page = i + 1
//                                                     if (
//                                                         page === 1 ||
//                                                         page === totalPages ||
//                                                         (page >=
//                                                             currentPage - 1 &&
//                                                             page <=
//                                                                 currentPage + 1)
//                                                     ) {
//                                                         return (
//                                                             <PaginationItem
//                                                                 key={page}
//                                                             >
//                                                                 <PaginationLink
//                                                                     href={createPageURL(
//                                                                         page
//                                                                     )}
//                                                                     isActive={
//                                                                         page ===
//                                                                         currentPage
//                                                                     }
//                                                                 >
//                                                                     {page}
//                                                                 </PaginationLink>
//                                                             </PaginationItem>
//                                                         )
//                                                     }

//                                                     if (
//                                                         page ===
//                                                             currentPage - 2 ||
//                                                         page === currentPage + 2
//                                                     ) {
//                                                         return (
//                                                             <PaginationItem
//                                                                 key={page}
//                                                             >
//                                                                 <PaginationEllipsis className="text-black" />
//                                                             </PaginationItem>
//                                                         )
//                                                     }

//                                                     return null
//                                                 }
//                                             )}

//                                             <PaginationItem>
//                                                 <PaginationNext
//                                                     href={createPageURL(
//                                                         currentPage + 1
//                                                     )}
//                                                     className={`transition-opacity ${currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
//                                                 />
//                                             </PaginationItem>
//                                         </PaginationContent>
//                                     </Pagination>
//                                 </div>
//                             </div>
//                         )}
//                     </div>
//                 </div>
//             </div>
//         </SidebarProvider>
//     )
// }

// function LoadingSkeleton() {
//     return (
//         <div className="p-7 h-screen w-full bg-bg">
//             <div className="flex flex-col h-full w-full border-2 border-border bg-white overflow-hidden">
//                 {/* Header Skeleton */}
//                 <div className="border-b border-gray-500 pt-5">
//                     <div className="container flex gap-5 mx-auto px-4">
//                         <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
//                     </div>
//                 </div>

//                 {/* Search Skeleton */}
//                 <div className="container mx-auto px-4 py-4">
//                     <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
//                 </div>

//                 {/* Files Skeleton */}
//                 <div className="flex-1 overflow-hidden">
//                     <div className="container mx-auto px-4">
//                         <div className="space-y-2 pb-4">
//                             {Array.from({ length: 5 }).map((_, index) => (
//                                 <div
//                                     key={index}
//                                     className="flex items-start gap-4 p-4 rounded-lg bg-[#F4F4F4] border border-gray-200 animate-pulse"
//                                 >
//                                     <div className="flex-shrink-0">
//                                         <div className="h-8 w-8 bg-bg rounded" />
//                                     </div>
//                                     <div className="flex-1">
//                                         <div className="h-4 w-1/4 bg-bg rounded mb-2" />
//                                         <div className="h-3 w-3/4 bg-bg rounded" />
//                                     </div>
//                                 </div>
//                             ))}
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     )
// }

// export default function FilesPage() {
//     return (
//         <Suspense fallback={<LoadingSkeleton />}>
//             <FilesList />
//         </Suspense>
//     )
// }

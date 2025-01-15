import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, truncate } from '@/lib/utils'
import { Files } from 'lucide-react'
import { useEffect, useState } from 'react'

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
    chatId,
    className,
}: FileSelectorProps) {
    const [files, setFiles] = useState<File[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(selectedFileIds)
    )
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        setSelectedIds(new Set(selectedFileIds))
    }, [selectedFileIds])

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const response = await fetch('/api/files')
                if (!response.ok) throw new Error('Failed to fetch files')
                const data = await response.json()
                setFiles(data)
            } catch (error) {
                console.error('Error fetching files:', error)
            }
        }

        if (isOpen || selectedFileIds.length > 0) {
            fetchFiles()
        }
    }, [isOpen, selectedFileIds.length])

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
                    {selectedIds.size > 0 && (
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
                    <h4 className="font-medium">Your Files</h4>
                </div>
                <ScrollArea className="h-[300px]">
                    <div className="p-4">
                        {files.length === 0 ? (
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
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
} 
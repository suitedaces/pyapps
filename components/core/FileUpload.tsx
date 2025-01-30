import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Database, ChevronRight as ChevronIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileAnalysisView } from './FileAnalysisView'

interface FileUploadProps {
    file: {
        name: string
        size: number
        lastModified: number
        analysis?: any
    }
}

export interface ColumnInfo {
    name: string
    type: string
    sample_values: string[]
}

export interface FileAnalysis {
    metadata: {
        rows: number
        columns: number
        size_bytes: number
        has_header: boolean
    }
    column_info: ColumnInfo[]
}

export function FileUpload({ file }: FileUploadProps) {
    const [showAnalysis, setShowAnalysis] = useState(false)

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString()
    }

    const parseAnalysis = (analysis: any): FileAnalysis | null => {
        try {
            if (typeof analysis === 'string') {
                return JSON.parse(analysis)
            }
            return analysis
        } catch (error) {
            console.error('Failed to parse analysis:', error)
            return null
        }
    }

    const parsedAnalysis = file.analysis ? parseAnalysis(file.analysis) : null

    return (
        <motion.div 
            className="mt-4 space-y-4"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <div className="bg-neutral-50/50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                        <FileText className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                {file.name}
                            </h3>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                                {formatBytes(file.size)}
                            </span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            Last modified: {formatDate(file.lastModified)}
                        </div>
                        
                        {parsedAnalysis && (
                            <div className="mt-3">
                                <button
                                    onClick={() => setShowAnalysis(!showAnalysis)}
                                    className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                                >
                                    <Database className="w-3.5 h-3.5" />
                                    <span>Metadata</span>
                                    <ChevronIcon 
                                        className={cn(
                                            "w-3.5 h-3.5 transition-transform",
                                            showAnalysis && "rotate-90"
                                        )} 
                                    />
                                </button>
                                
                                {showAnalysis && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3"
                                    >
                                        <FileAnalysisView analysis={parsedAnalysis} />
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
} 
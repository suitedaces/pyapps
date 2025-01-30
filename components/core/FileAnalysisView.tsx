import { Table, Type } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ColumnInfo {
    name: string
    type: string
    sample_values: string[]
}

interface FileAnalysis {
    metadata: {
        rows: number
        columns: number
        size_bytes: number
        has_header: boolean
    }
    column_info: ColumnInfo[]
}

interface FileAnalysisViewProps {
    analysis: FileAnalysis
}

export function FileAnalysisView({ analysis }: FileAnalysisViewProps) {
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatValue = (value: any): string => {
        if (value === null) return 'null'
        if (value === undefined) return 'undefined'
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value).replace(/"/g, '')
    }

    return (
        <div className="space-y-4">
            {/* Metadata Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-lg border border-blue-200 dark:border-blue-500/30">
                    <div className="text-xs text-blue-500 font-medium">Rows</div>
                    <div className="text-sm font-semibold mt-1">{analysis.metadata.rows.toLocaleString()}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
                    <div className="text-xs text-emerald-500 font-medium">Columns</div>
                    <div className="text-sm font-semibold mt-1">{analysis.metadata.columns}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-500/10 p-3 rounded-lg border border-purple-200 dark:border-purple-500/30">
                    <div className="text-xs text-purple-500 font-medium">Size</div>
                    <div className="text-sm font-semibold mt-1">{formatBytes(analysis.metadata.size_bytes)}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg border border-amber-200 dark:border-amber-500/30">
                    <div className="text-xs text-amber-500 font-medium">Has Header</div>
                    <div className="text-sm font-semibold mt-1">{analysis.metadata.has_header ? 'Yes' : 'No'}</div>
                </div>
            </div>

            {/* Column Information */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    <Table className="w-4 h-4" />
                    <span>Column Details</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {analysis.column_info.length} columns
                    </span>
                </div>
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-1.5 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                    {analysis.column_info.map((col, index) => (
                        <div 
                            key={index}
                            className="bg-neutral-50 dark:bg-neutral-900 p-2 rounded-lg border-2 border-neutral-200 dark:border-neutral-700"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Type className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                                    <span className="text-xs font-medium truncate">{col.name.replace(/"/g, '')}</span>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full flex-shrink-0">
                                    {col.type}
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 space-y-0.5">
                                    {col.sample_values.slice(0, 2).map((value, i) => {
                                        const formattedValue = formatValue(value)
                                        return (
                                            <div 
                                                key={i} 
                                                className="pl-1.5 border-l border-neutral-200 dark:border-neutral-700 truncate"
                                                title={formattedValue}
                                            >
                                                {formattedValue}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
} 
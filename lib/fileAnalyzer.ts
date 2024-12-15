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
        type: {
            primary: ColumnType
            confidence: number
        }
        sample_values: any[]
        stats: {
            unique_count: number
            null_count: number
            numeric_stats?: {
                min: number
                max: number
                mean: number
            }
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
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || // ISO date
                /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(trimmed)) { // Common date formats
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
                    count: 0
                }
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
        const numValue = type === 'number' ? 
            (typeof value === 'number' ? value : parseFloat(value)) : 
            NaN

        if (!isNaN(numValue)) {
            stats.numbers.count++
            stats.numbers.sum += numValue
            if (stats.numbers.min === undefined || numValue < stats.numbers.min) {
                stats.numbers.min = numValue
            }
            if (stats.numbers.max === undefined || numValue > stats.numbers.max) {
                stats.numbers.max = numValue
            }
        }
    }

    function getPrimaryType(types: Map<ColumnType, number>): {
        primary: ColumnType
        confidence: number
    } {
        const total = Array.from(types.values()).reduce((a, b) => a + b, 0)
        const entries = Array.from(types.entries())
            .filter(([type]) => type !== 'null')
            .sort((a, b) => b[1] - a[1])

        if (entries.length === 0) return { primary: 'null', confidence: 1 }
        if (entries.length === 1) return { primary: entries[0][0], confidence: 1 }

        const [primaryType, primaryCount] = entries[0]
        const confidence = primaryCount / total

        return {
            primary: confidence > 0.7 ? primaryType : 'mixed',
            confidence
        }
    }

    return new Promise((resolve) => {
        Papa.parse(content.trim(), {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            fastMode: true,
            chunk: ({ data, meta }: { data: any[], meta: any }) => {
                if (rowCount === 0 && meta.fields) {
                    headerRow = meta.fields
                }

                rowCount += data.length

                data.forEach(row => {
                    headerRow.forEach(column => {
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
                        has_header: true
                    },
                    column_info: headerRow.map(column => {
                        const stats = columnStats.get(column)!
                        const type = getPrimaryType(stats.types)

                        return {
                            name: column,
                            type,
                            sample_values: Array.from(stats.values).slice(0, 5),
                            stats: {
                                unique_count: stats.values.size,
                                null_count: stats.nullCount,
                                ...(stats.numbers.count > 0 && {
                                    numeric_stats: {
                                        min: stats.numbers.min!,
                                        max: stats.numbers.max!,
                                        mean: stats.numbers.sum / stats.numbers.count
                                    }
                                })
                            }
                        }
                    })
                }
                resolve(analysis)
            }
        })
    })
}
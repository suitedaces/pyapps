import Papa from 'papaparse'

export interface AnalysisOptions {
    detailed?: boolean
    maxRows?: number
    sampleSize?: number
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
        type: string
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
    const columnStats = new Map<string, {
        values: Set<any>
        nullCount: number
        numbers: number[]
        min?: number
        max?: number
        sum?: number
    }>()

    let rowCount = 0
    let headerRow: string[] = []
    let sampleRows: any[] = []

    return new Promise((resolve) => {
        Papa.parse(content.trim(), {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            fastMode: true,
            chunk: ({ data, meta }: { data: any[], meta: any }) => {
                // Initialize tracking on first chunk
                if (rowCount === 0 && meta.fields) {
                    headerRow = meta.fields
                    meta.fields.forEach((field: string) => {
                        columnStats.set(field, {
                            values: new Set(),
                            nullCount: 0,
                            numbers: []
                        })
                    })
                }

                rowCount += data.length

                // Sample management (keep first N rows)
                if (sampleRows.length < SAMPLE_SIZE) {
                    sampleRows.push(...data.slice(0, SAMPLE_SIZE - sampleRows.length))
                }

                // Process each row for statistics
                data.forEach(row => {
                    headerRow.forEach(column => {
                        const value = row[column]
                        const stats = columnStats.get(column)!

                        if (value === null || value === undefined || value === '') {
                            stats.nullCount++
                        } else {
                            if (stats.values.size < SAMPLE_SIZE) {
                                stats.values.add(value)
                            }

                            if (typeof value === 'number') {
                                // Update running statistics
                                if (stats.min === undefined || value < stats.min) stats.min = value
                                if (stats.max === undefined || value > stats.max) stats.max = value
                                stats.sum = (stats.sum || 0) + value
                                stats.numbers.push(value)
                            }
                        }
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
                        const hasNumbers = stats.numbers.length > 0

                        return {
                            name: column,
                            type: hasNumbers ? 'number' : 'string',
                            sample_values: Array.from(stats.values).slice(0, 5),
                            stats: {
                                unique_count: stats.values.size,
                                null_count: stats.nullCount,
                                ...(hasNumbers && {
                                    numeric_stats: {
                                        min: stats.min!,
                                        max: stats.max!,
                                        mean: stats.sum! / stats.numbers.length
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
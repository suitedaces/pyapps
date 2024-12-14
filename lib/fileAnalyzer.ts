import Papa from 'papaparse'

export interface AnalysisOptions {
    detailed?: boolean
    maxRows?: number
    sampleSize?: number
}

export interface ColumnMetadata {
    name: string
    type: {
        primary: ColumnType
        alt?: ColumnType
        confidence: number
        possible_types: ColumnType[]
    }
    samples: {
        head: any[]
        tail: any[]
        random: any[]
        uniques: any[]
    }
    stats: {
        unique_count: number
        null_count: number
        empty_count: number
        numeric_stats?: {
            min: number
            max: number
            mean: number
        }
        string_stats?: {
            min_length: number
            max_length: number
            patterns: string[]
        }
    }
}

export interface CSVAnalysis {
    metadata: {
        rows: number
        columns: number
        size_bytes: number
        has_header: boolean
        delimiter: string
        encoding: string
    }
    column_info: ColumnMetadata[]
    sample_rows: any[]
    data_quality: {
        complete_rows: number
        duplicate_rows: number
        consistent_types: boolean
    }
}

type ColumnType = 'number' | 'boolean' | 'date' | 'string' | 'mixed' | 'unknown'

export async function analyzeCSV(
    content: string,
    options: AnalysisOptions = {}
): Promise<CSVAnalysis> {
    const SAMPLE_SIZE = options.sampleSize || 1000
    const columnTracker = new Map<string, {
        values: Set<any>
        types: Set<ColumnType>
        nulls: number
        empties: number
        numbers: number[]
        strings: Set<string>
        patterns: Set<string>
    }>()

    let rows: any[] = []
    let rowCount = 0
    let completeRows = 0
    let duplicateHashes = new Set<string>()

    return new Promise((resolve) => {
        Papa.parse(content.trim(), {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            fastMode: true,
            chunk: ({ data, meta }: { data: any[], meta: any }) => {
                rowCount += data.length

                // Initialize column tracking if first chunk
                if (columnTracker.size === 0 && meta.fields) {
                    meta.fields.forEach((field: string) => {
                        columnTracker.set(field, {
                            values: new Set(),
                            types: new Set(),
                            nulls: 0,
                            empties: 0,
                            numbers: [],
                            strings: new Set(),
                            patterns: new Set()
                        })
                    })
                }

                // Sample management
                if (rows.length < SAMPLE_SIZE * 2) {
                    rows.push(...data.slice(0, SAMPLE_SIZE))
                } else {
                    rows.splice(SAMPLE_SIZE, SAMPLE_SIZE, ...data.slice(-SAMPLE_SIZE))
                }

                // Process each row
                data.forEach((row: any) => {
                    let isComplete = true
                    const rowValues = Object.values(row)
                    
                    const rowHash = rowValues.join('|')
                    if (duplicateHashes.has(rowHash)) {
                        duplicateHashes.add(rowHash)
                    }

                    columnTracker.forEach((tracker, columnName) => {
                        const value = row[columnName]

                        if (value === null || value === undefined) {
                            tracker.nulls++
                            isComplete = false
                        } else if (value === '') {
                            tracker.empties++
                            isComplete = false
                        } else {
                            const inferredType = inferType(value)
                            tracker.types.add(inferredType)

                            if (tracker.values.size < SAMPLE_SIZE) {
                                tracker.values.add(value)
                            }

                            if (typeof value === 'number') {
                                tracker.numbers.push(value)
                            } else if (typeof value === 'string') {
                                if (tracker.strings.size < 100) {
                                    tracker.strings.add(value)
                                }
                                if (tracker.patterns.size < 10) {
                                    tracker.patterns.add(inferStringPattern(value))
                                }
                            }
                        }
                    })

                    if (isComplete) completeRows++
                })
            },
            complete: () => {
                const analysis: CSVAnalysis = {
                    metadata: {
                        rows: rowCount,
                        columns: columnTracker.size,
                        size_bytes: content.length,
                        has_header: true,
                        delimiter: ',',
                        encoding: 'utf-8'
                    },
                    column_info: Array.from(columnTracker.entries()).map(([name, tracker]) => {
                        const primaryType = getPrimaryType(tracker.types)
                        return {
                            name,
                            type: {
                                primary: primaryType,
                                confidence: tracker.types.size === 1 ? 1 : 0.8,
                                possible_types: Array.from(tracker.types)
                            },
                            samples: {
                                head: rows.slice(0, 5).map(r => r[name]),
                                tail: rows.slice(-5).map(r => r[name]),
                                random: getRandomElements(Array.from(tracker.values), 5),
                                uniques: Array.from(tracker.values).slice(0, 10)
                            },
                            stats: {
                                unique_count: tracker.values.size,
                                null_count: tracker.nulls,
                                empty_count: tracker.empties,
                                ...(tracker.numbers.length > 0 && {
                                    numeric_stats: calculateNumericStats(tracker.numbers)
                                }),
                                ...(tracker.strings.size > 0 && {
                                    string_stats: {
                                        min_length: Math.min(...Array.from(tracker.strings).map(s => s.length)),
                                        max_length: Math.max(...Array.from(tracker.strings).map(s => s.length)),
                                        patterns: Array.from(tracker.patterns)
                                    }
                                })
                            }
                        }
                    }),
                    sample_rows: rows.slice(0, options.maxRows || 5),
                    data_quality: {
                        complete_rows: completeRows,
                        duplicate_rows: duplicateHashes.size,
                        consistent_types: Array.from(columnTracker.values())
                            .every(tracker => tracker.types.size <= 1)
                    }
                }
                resolve(analysis)
            }
        })
    })
}

function inferType(value: any): ColumnType {
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (value instanceof Date) return 'date'
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date'
        if (/^\d+$/.test(value)) return 'number'
        if (/^(true|false)$/i.test(value)) return 'boolean'
    }
    return 'string'
}

function getPrimaryType(types: Set<ColumnType>): ColumnType {
    if (types.size === 0) return 'unknown'
    if (types.size === 1) return types.values().next().value as ColumnType
    if (types.has('number')) return 'number'
    if (types.has('date')) return 'date'
    if (types.has('boolean')) return 'boolean'
    if (types.has('string')) return 'string'
    return 'mixed'
}

function calculateNumericStats(numbers: number[]) {
    return {
        min: Math.min(...numbers),
        max: Math.max(...numbers),
        mean: numbers.reduce((a, b) => a + b, 0) / numbers.length
    }
}

function inferStringPattern(str: string): string {
    return str.replace(/[A-Z]+/g, 'A')
        .replace(/[a-z]+/g, 'a')
        .replace(/[0-9]+/g, '9')
}

function getRandomElements<T>(arr: T[], n: number): T[] {
    const result = new Array<T>(n)
    const len = arr.length
    const taken = new Set<number>()
    
    if (n > len) return arr.slice()
    
    while (taken.size < n) {
        const x = Math.floor(Math.random() * len)
        if (!taken.has(x)) {
            taken.add(x)
            result[taken.size - 1] = arr[x]
        }
    }
    
    return result
}
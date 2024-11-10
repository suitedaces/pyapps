import { z } from 'zod'
import Papa from 'papaparse'
import { FileContext } from './types'

export interface AnalysisOptions {
    detailed?: boolean
    maxRows?: number
}

export interface ColumnAnalysis {
    uniqueCount: number
    nullCount: number
    min?: number
    max?: number
    mean?: number
}

export interface CSVAnalysis {
    columns: string[]
    rowCount: number
    columnTypes: Record<string, ColumnType>
    summary: Record<string, ColumnAnalysis>
    sampleData: any[]
}

export interface JSONAnalysis {
    structure: string
    depth: number
    sampleData?: any
}

export type FileAnalysis = CSVAnalysis | JSONAnalysis

export async function analyzeFile(
    content: string,
    fileType: FileContext['fileType'],
    options?: AnalysisOptions
): Promise<FileAnalysis> {
    console.log('📊 Starting file analysis:', {
        fileType,
        contentLength: content.length,
        options
    })

    try {
        const result = await (async () => {
            switch (fileType) {
                case 'csv':
                    return analyzeCSV(content, options)
                case 'json':
                    return analyzeJSON(content, options)
                default:
                    throw new Error(`Unsupported file type: ${fileType}`)
            }
        })()

        console.log('✅ File analysis completed:', {
            fileType,
            analysisType: result.constructor.name
        })

        return result
    } catch (error) {
        console.error('❌ File analysis failed:', {
            fileType,
            error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
    }
}

export async function analyzeCSV(
    content: string,
    options?: AnalysisOptions
): Promise<CSVAnalysis> {
    console.log('📊 Starting CSV analysis:', {
        contentLength: content.length,
        options
    })

    try {
        const parsed = Papa.parse(content.trim(), {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        })

        console.log('📋 CSV parsing completed:', {
            rowCount: parsed.data.length,
            columnCount: parsed.meta.fields?.length
        })

        const columns = parsed.meta.fields || []
        const rows = parsed.data as Record<string, any>[]
        const rowCount = rows.length

        const analysis: CSVAnalysis = {
            columns,
            rowCount,
            columnTypes: {},
            summary: {},
            sampleData: rows.slice(0, options?.maxRows || 5)
        }

        columns.forEach(column => {
            const values = rows.map(row => row[column])
                .filter(v => v !== null && v !== undefined)
            const type = inferColumnType(values)
            analysis.columnTypes[column] = type

            if (options?.detailed) {
                analysis.summary[column] = analyzeColumn(values, type)
            }
        })

        console.log('✅ CSV analysis completed:', {
            columns: analysis.columns.length,
            rowCount: analysis.rowCount,
            sampleSize: analysis.sampleData.length
        })

        return analysis
    } catch (error) {
        console.error('❌ CSV analysis error:', error)
        throw new Error('Failed to analyze CSV file')
    }
}

export async function analyzeJSON(
    content: string,
    options?: AnalysisOptions
): Promise<JSONAnalysis> {
    console.log('📊 Starting JSON analysis')

    try {
        const data = JSON.parse(content)
        const analysis: JSONAnalysis = {
            structure: inferJSONStructure(data),
            depth: calculateJSONDepth(data),
            sampleData: options?.detailed ? data : undefined
        }

        console.log('✅ JSON analysis completed:', {
            structure: analysis.structure,
            depth: analysis.depth
        })

        return analysis
    } catch (error) {
        console.error('❌ JSON analysis error:', error)
        throw new Error('Failed to analyze JSON file')
    }
}

// Add type definition for column types
type ColumnType = 'number' | 'boolean' | 'date' | 'string' | 'mixed' | 'unknown'

function inferColumnType(values: any[]): ColumnType {
    if (values.length === 0) return 'unknown'

    const types = values.map(value => {
        if (typeof value === 'number') return 'number' as const
        if (typeof value === 'boolean') return 'boolean' as const
        if (value instanceof Date) return 'date' as const
        if (typeof value === 'string') {
            if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date' as const
            if (/^\d+$/.test(value)) return 'number' as const
            if (/^(true|false)$/i.test(value)) return 'boolean' as const
        }
        return 'string' as const
    }) as ColumnType[]

    // Use a type guard to ensure type safety
    const isSameType = (type: ColumnType, acc: ColumnType): ColumnType => {
        return type === acc ? type : 'mixed'
    }

    return types.reduce(isSameType, types[0] || 'unknown')
}

function analyzeColumn(values: any[], type: string): ColumnAnalysis {
    const summary: ColumnAnalysis = {
        uniqueCount: new Set(values).size,
        nullCount: values.filter(v => v === null || v === undefined).length
    }

    if (type === 'number') {
        const numbers = values.filter(v => typeof v === 'number')
        if (numbers.length > 0) {
            summary.min = Math.min(...numbers)
            summary.max = Math.max(...numbers)
            summary.mean = numbers.reduce((a, b) => a + b, 0) / numbers.length
        }
    }

    return summary
}

function inferJSONStructure(data: any): string {
    if (Array.isArray(data)) {
        return `array[${data.length}]`
    }
    if (typeof data === 'object' && data !== null) {
        return `object{${Object.keys(data).length}}`
    }
    return typeof data
}

function calculateJSONDepth(data: any): number {
    if (typeof data !== 'object' || data === null) return 0
    return 1 + Math.max(
        ...Object.values(data).map(v => calculateJSONDepth(v)),
        -1
    )
}

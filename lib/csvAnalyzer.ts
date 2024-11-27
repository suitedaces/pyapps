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
                const sampleSize = Math.min(1000, rows.length)
                const sampleRows = rows.slice(0, sampleSize)

                const analysis: CSVAnalysis = {
                    totalRows: rows.length,
                    columns: headers.map((header, index) => ({
                        name: header,
                        type: inferColumnType(
                            sampleRows.map((row) => row[index])
                        ),
                    })),
                    sampleRows: sampleRows.slice(0, 11), // Keep first 10 rows for display
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

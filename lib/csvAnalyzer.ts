import { parse } from 'papaparse'
import prisma from './prisma'
import { CSVAnalysis } from './types'

export async function analyzeCSV(csvContent: string, chatId: string): Promise<CSVAnalysis> {
  return new Promise((resolve, reject) => {
    parse(csvContent, {
      complete: async (results) => {
        const data = results.data as string[][]
        const headers = data[0]
        const rows = data.slice(1)
        const sampleSize = Math.min(1000, rows.length)
        const sampleRows = rows.slice(0, sampleSize)

        const analysis: CSVAnalysis = {
          totalRows: rows.length,
          columns: headers.map((header, index) => ({
            name: header,
            type: inferColumnType(sampleRows.map(row => row[index]))
          })),
          sampleRows: sampleRows.slice(0, 5) // Keep first 5 rows for display
        }

        // Store the analysis in the database
        await prisma.cSVAnalysis.create({
          data: {
            chatId,
            totalRows: analysis.totalRows,
            columns: analysis.columns,
            sampleRows: analysis.sampleRows,
          },
        })

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
  
  const isNumeric = sample.every(value => !isNaN(Number(value)) && value.trim() !== '')
  const isBoolean = sample.every(value => ['true', 'false', '0', '1'].includes(value.toLowerCase()))
  const isDate = sample.every(value => !isNaN(Date.parse(value)))

  if (isBoolean) return 'boolean'
  if (isNumeric) return 'number'
  if (isDate) return 'date'
  return 'string'
}
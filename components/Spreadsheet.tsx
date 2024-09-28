import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Download, Maximize2, Minimize2 } from 'lucide-react'
import { CSVAnalysis } from '@/lib/csvAnalyzer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import LoadingSpinner from './LoadingSpinner'

interface SpreadsheetProps {
    analysis: CSVAnalysis
    onClose: () => void
    fullData: string[][] | null
}

const Spreadsheet: React.FC<SpreadsheetProps> = ({ analysis, onClose, fullData }) => {
    const [isMaximized, setIsMaximized] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const tableRef = useRef<HTMLTableElement>(null)

    const toggleMaximize = () => {
        if (!isMaximized) {
            setIsLoading(true)
            setIsMaximized(true)
            setTimeout(() => {
                setIsLoading(false)
            }, 1000)
        } else {
            setIsMaximized(false)
        }
    }

    const truncateText = (text: string, maxLength: number) => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    const renderTable = (data: string[][], startIndex: number = 0) => (
        <table ref={tableRef} className="w-full border-collapse table-auto">
            <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                    <th className="border-r border-gray-300 px-2 py-2 text-left font-bold">#</th>
                    {analysis.columns.map((column, index) => (
                        <th key={index} className="border-r border-gray-300 px-4 py-2 text-left font-bold whitespace-nowrap overflow-hidden" style={{ maxWidth: '200px' }}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="block truncate">{truncateText(column.name, 20)}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{column.name}</p>
                                </TooltipContent>
                            </Tooltip>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border-r border-gray-300 px-2 py-2 text-gray-500 text-sm">{startIndex + rowIndex + 1}</td>
                        {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="border-r border-gray-300 px-4 py-2 overflow-hidden text-ellipsis" style={{ maxWidth: '200px' }}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="block truncate">{truncateText(cell, 20)}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{cell}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )

    return (
        <TooltipProvider>
            <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className={`bg-white border border-gray-300 overflow-hidden rounded-lg shadow-lg
                    ${isMaximized
                        ? 'fixed inset-0 z-50 m-4'
                        : 'right-4 top-4 w-full h-[50vh]'}`}
            >
                <div className="w-full h-full flex flex-col">
                    <div className="flex items-center justify-between p-2 border-b border-gray-300 bg-gray-100">
                        <h2 className="text-sm font-bold">CSV Analysis</h2>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-mono">{analysis.totalRows} rows</span>
                            <Button variant="outline" size="sm" className="border border-gray-300 rounded">
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={toggleMaximize} className="border border-gray-300 rounded">
                                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-auto relative">
                        <AnimatePresence initial={false} mode="wait">
                            {!isMaximized && (
                                <motion.div
                                    key="minimized"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {renderTable(analysis.sampleRows)}
                                </motion.div>
                            )}
                            {isMaximized && (
                                <motion.div
                                    key="maximized"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="relative w-full h-full"
                                >
                                    {isLoading ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
                                            <LoadingSpinner />
                                        </div>
                                    ) : (
                                        renderTable(fullData || [])
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </TooltipProvider>
    )
}

export default Spreadsheet

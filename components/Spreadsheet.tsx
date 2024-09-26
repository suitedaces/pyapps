import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Download, Maximize2, Minimize2 } from 'lucide-react'
import { CSVAnalysis } from '@/lib/csvAnalyzer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SpreadsheetProps {
    analysis: CSVAnalysis
    onClose: () => void
    fullData: string[][] | null
}

const Spreadsheet: React.FC<SpreadsheetProps> = ({ analysis, onClose, fullData }) => {
    const [isMaximized, setIsMaximized] = useState(false)
    const tableRef = useRef<HTMLTableElement>(null)

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized)
    }

    const truncateText = (text: string, maxLength: number) => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    const displayedRows = isMaximized && fullData ? fullData : analysis.sampleRows


    return (
        <TooltipProvider>
            <AnimatePresence mode="wait">
                <motion.div
                    key={isMaximized ? 'maximized' : 'minimized'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className={`bg-white border border-black overflow-hidden rounded-lg
            ${isMaximized
                            ? 'fixed inset-0 z-50 m-4'
                            : 'right-4 top-4 w-full h-[50vh]'}`}
                >
                    <div className="w-full h-full flex flex-col">
                        <div className="flex items-center justify-between p-2 border-b border-black bg-yellow-200">
                            <h2 className="text-sm font-bold">CSV Analysis</h2>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-mono">{analysis.totalRows} rows</span>
                                <Button variant="outline" size="sm" className="border border-black rounded">
                                    <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={toggleMaximize} className="border border-black rounded">
                                    {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="flex-grow overflow-auto">
                            <table ref={tableRef} className="w-full border-collapse table-auto">
                                <thead className="sticky top-0 bg-yellow-200 z-10">
                                    <tr>
                                        {analysis.columns.map((column, index) => (
                                            <th key={index} className="border border-black px-4 py-2 text-left font-bold whitespace-nowrap overflow-hidden" style={{ maxWidth: '200px' }}>
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
                                    {displayedRows.map((row, rowIndex) => (
                                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                                            {row.map((cell, cellIndex) => (
                                                <td key={cellIndex} className="border border-black px-4 py-2 overflow-hidden text-ellipsis" style={{ maxWidth: '200px' }}>
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
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </TooltipProvider>
    )
}

export default Spreadsheet

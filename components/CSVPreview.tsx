import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface CSVPreviewProps {
    csvAnalysis: {
        columns: {
            name: string
            type: string
        }[]
        sampleRows: string[][]
        totalRows: number
    }
}

export function CSVPreview({ csvAnalysis }: CSVPreviewProps) {
    return (
        <div className="mt-4 bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                    CSV Preview
                </h3>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                <dl className="sm:divide-y sm:divide-gray-200 dark:divide-gray-700">
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Column Metadata
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Type</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {csvAnalysis.columns.map(
                                        (column, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    {column.name}
                                                </TableCell>
                                                <TableCell>
                                                    {column.type}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    )}
                                </TableBody>
                            </Table>
                        </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Sample Rows
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {csvAnalysis.columns.map(
                                            (column, index) => (
                                                <TableHead key={index}>
                                                    {column.name}
                                                </TableHead>
                                            )
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {csvAnalysis.sampleRows.map(
                                        (row, rowIndex) => (
                                            <TableRow key={rowIndex}>
                                                {row.map((cell, cellIndex) => (
                                                    <TableCell key={cellIndex}>
                                                        {cell}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    )}
                                </TableBody>
                            </Table>
                        </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Total Rows
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {csvAnalysis.totalRows}
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    )
}

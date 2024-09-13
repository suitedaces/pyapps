import React, { useState, useEffect } from "react";
import { analyzeCSV, CSVAnalysis } from "@/lib/csvAnalyzer";
import { Pie, PieChart, Cell, Tooltip, Legend } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function MetaSheet({ csvContent }: { csvContent: any }) {
  const [analysis, setAnalysis] = useState<CSVAnalysis | null>(null);
  const [chartData, setChartData] = useState<
    Array<{ name: string; value: number }>
  >([]);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setIsAtBottom(scrollHeight - scrollTop === clientHeight);
  };

  useEffect(() => {
    async function performAnalysis() {
      try {
        const result = await analyzeCSV(csvContent);
        setAnalysis(result);

        // Calculate type distribution
        const distribution = result.columns.reduce(
          (acc, col) => {
            acc[col.type] = (acc[col.type] || 0) + 1;
            return acc;
          },
          {} as { [key: string]: number },
        );

        // Transform distribution into chart data
        const data = Object.entries(distribution).map(([name, value]) => ({
          name,
          value,
        }));
        setChartData(data);

        console.log("Analysis result:", result);
        console.log("Chart data:", data);
      } catch (error) {
        console.error("Error analyzing CSV:", error);
      }
    }

    if (csvContent) {
      performAnalysis();
    }
  }, [csvContent]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  const generateSampleRows = (columns: any[], existingRows: any[][]) => {
    const targetRowCount = Math.floor(Math.random() * 11) + 10;
    const sampleRows = [];

    for (let i = 0; i < targetRowCount; i++) {
      const rowIndex = i % existingRows.length;
      sampleRows.push(existingRows[rowIndex]);
    }

    return sampleRows;
  };

  return (
    <div className="h-full max-h-[82vh] flex-grow rounded-lg shadow-lg overflow-hidden">
      <ScrollArea
        className="flex-grow p-4 h-full space-y-4"
        onScroll={handleScroll}
      >
        <h2 className="text-text text-3xl font-semibold">Metadata</h2>
        {analysis ? (
          <div className="w-full text-text mt-6">
            <div className="max-w-md">
              <div className="bg-white rounded-3xl border-2 border-border overflow-hidden">
                <div className="divide-y-2 divide-border">
                  <div className="grid divide-x-2 divide-border grid-cols-2 items-center">
                    <div className="p-4 rounded-tl-3xl">
                      <span className="text-md font-semibold">Total Rows</span>
                    </div>
                    <div className="p-4 text-right rounded-tr-3xl">
                      <span className="text-xl font-bold">
                        {analysis.totalRows}
                      </span>
                    </div>
                  </div>
                  <div className="grid divide-x-2 divide-border grid-cols-2 items-center">
                    <div className="p-4  rounded-bl-3xl">
                      <span className="text-md font-semibold">
                        Total Columns
                      </span>
                    </div>
                    <div className="p-4  text-right rounded-br-3xl">
                      <span className="text-xl font-bold">
                        {analysis.columns.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 w-full">
              <Card className="flex border-border border-2 rounded-3xl flex-col mt-6 xl:w-1/2">
                <CardHeader className="items-center pb-0">
                  <CardTitle>Data Type Distribution</CardTitle>
                  <CardDescription>Column Types in CSV</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <div className="mx-auto aspect-square max-h-[200px] mb-10">
                    <PieChart width={200} height={300}>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                      />
                    </PieChart>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex border-border border-2 rounded-3xl flex-col mt-6 xl:w-1/2">
                <CardHeader className="items-center pb-0">
                  <CardTitle>CSV Column Names and Sample Data</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <div className="overflow-x-auto mt-10">
                    <Table>
                      <TableCaption className="text-text dark:text-darkText">
                        First row of data from the CSV file
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          {analysis.columns.map((column, index) => (
                            <TableHead key={index}>{column.name}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          {analysis.sampleRows[0].map((value, cellIndex) => (
                            <TableCell key={cellIndex}>{value}</TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-10">
              <h2 className="text-text text-3xl font-semibold mb-6">
                Spreadsheet
              </h2>
              <div className="overflow-x-auto mt-10">
                <Table>
                  <TableCaption className="text-text dark:text-darkText">
                    10 - 20 rows of data from the CSV file
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      {analysis.columns.map((column, index) => (
                        <TableHead key={index}>{column.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generateSampleRows(
                      analysis.columns,
                      analysis.sampleRows,
                    ).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((value, cellIndex) => (
                          <TableCell key={cellIndex}>{value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Add a button that will take to the uploaded csv data in File route where user can access the whole spreadsheet
                            in lazy loading manner and the details of csv uploaded that time */}
            </div>
          </div>
        ) : (
          <p>Analyzing CSV...</p>
        )}
      </ScrollArea>
    </div>
  );
}

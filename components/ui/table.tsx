import * as React from 'react';

interface TableProps {
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ children }) => (
  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
    {children}
  </table>
);

export const TableHeader: React.FC<TableProps> = ({ children }) => (
  <thead className="bg-gray-50 dark:bg-gray-800">
    {children}
  </thead>
);

export const TableBody: React.FC<TableProps> = ({ children }) => (
  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
    {children}
  </tbody>
);

export const TableRow: React.FC<TableProps> = ({ children }) => (
  <tr>
    {children}
  </tr>
);

export const TableHead: React.FC<TableProps> = ({ children }) => (
  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
    {children}
  </th>
);

export const TableCell: React.FC<TableProps> = ({ children }) => (
  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
    {children}
  </td>
);
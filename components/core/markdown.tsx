import Link from "next/link";
import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function parseCSVToMarkdownTable(text: string): string {
    const mainTextMatch = text.match(/^(.*?)\s*(?=⚠️|$)/);
    const mainText = mainTextMatch ? mainTextMatch[1].trim() : '';
    const processedContent = [];
    let headers: string[] = [];

    if (mainText) {
        processedContent.push(mainText);
    }

    const columnMatch = text.match(/⚠️ EXACT column names:\s*([^]*?)(?=First 5 rows:|$)/);
    if (columnMatch) {
        headers = columnMatch[1].trim().split(',').map(col => col.trim());
        processedContent.push(`⚠️ EXACT column names: ${headers.join(', ')}`);
    }

    const rowsMatch = text.match(/First 5 rows:\s*([^]*?)(?=Create a complex|$)/);
    if (rowsMatch && headers.length > 0) {
        const rowsData = rowsMatch[1].trim()
            .split(/\s+(?=D-\d{4})/)
            .map(row => row.trim())
            .filter(Boolean);

        const headerRow = `| ${headers.join(' | ')} |`;
        const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

        const tableRows = rowsData.map(row => {
            const cells = row.split(',').map(cell => cell.trim());
            return `| ${cells.join(' | ')} |`;
        });

        processedContent.push(`
  ${headerRow}
  ${separatorRow}
  ${tableRows.join('\n')}`);
    }

    const finalInstructionMatch = text.match(/Create a complex.*$/);
    if (finalInstructionMatch) {
        processedContent.push(finalInstructionMatch[0]);
    }

    return processedContent.join('\n\n');
}

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
    const components = {
        code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
                <pre
                    {...props}
                    className={`${className} text-sm w-[80dvw] md:max-w-[500px] overflow-x-scroll bg-zinc-100 p-3 rounded-lg mt-2 dark:bg-zinc-800`}
                >
                    <code className={match[1]}>{children}</code>
                </pre>
            ) : (
                <code
                    className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
                    {...props}
                >
                    {children}
                </code>
            );
        },
        ol: ({ node, children, ...props }: any) => {
            return (
                <ol className="list-decimal list-outside ml-4" {...props}>
                    {children}
                </ol>
            );
        },
        li: ({ node, children, ...props }: any) => {
            return (
                <li className="py-1" {...props}>
                    {children}
                </li>
            );
        },
        ul: ({ node, children, ...props }: any) => {
            return (
                <ul className="list-decimal list-outside ml-4" {...props}>
                    {children}
                </ul>
            );
        },
        strong: ({ node, children, ...props }: any) => {
            return (
                <span className="font-semibold" {...props}>
                    {children}
                </span>
            );
        },
        a: ({ node, children, ...props }: any) => {
            return (
                <Link
                    className="text-blue-500 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    {...props}
                >
                    {children}
                </Link>
            );
        },
    };

    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {children}
        </ReactMarkdown>
    );
};

export const Markdown = memo(
    NonMemoizedMarkdown,
    (prevProps, nextProps) => prevProps.children === nextProps.children,
);

// User Message Markdown

const NonMemoUserMarkdown = ({ children }: { children: string }) => {
    const processedContent = parseCSVToMarkdownTable(children);

    const components = {
        code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
                <pre
                    {...props}
                    className={`${className} text-sm w-[80dvw] md:max-w-[500px] overflow-x-scroll bg-zinc-100 p-3 rounded-lg mt-2 dark:bg-zinc-800`}
                >
                    <code className={match[1]}>{children}</code>
                </pre>
            ) : (
                <code
                    className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
                    {...props}
                >
                    {children}
                </code>
            );
        },
        table: ({ children, ...props }: any) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700" {...props}>
                    {children}
                </table>
            </div>
        ),
        thead: ({ children, ...props }: any) => (
            <thead className="bg-zinc-50 dark:bg-zinc-800" {...props}>
                {children}
            </thead>
        ),
        th: ({ children, ...props }: any) => (
            <th
                className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider"
                {...props}
            >
                {children}
            </th>
        ),
        td: ({ children, ...props }: any) => (
            <td
                className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700 dark:text-zinc-300"
                {...props}
            >
                {children}
            </td>
        ),
        ol: ({ node, children, ...props }: any) => {
            return (
                <ol className="list-decimal list-outside ml-4" {...props}>
                    {children}
                </ol>
            );
        },
        li: ({ node, children, ...props }: any) => {
            return (
                <li className="py-1" {...props}>
                    {children}
                </li>
            );
        },
        ul: ({ node, children, ...props }: any) => {
            return (
                <ul className="list-decimal list-outside ml-4" {...props}>
                    {children}
                </ul>
            );
        },
        strong: ({ node, children, ...props }: any) => {
            return (
                <span className="font-semibold" {...props}>
                    {children}
                </span>
            );
        },
        a: ({ node, children, ...props }: any) => {
            return (
                <Link
                    className="text-blue-500 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    {...props}
                >
                    {children}
                </Link>
            );
        },
        div: ({ className, children, ...props }: any) => {
            return (
                <div className={className} {...props}>
                    {children}
                </div>
            );
        },
    };

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={components}
            allowElement={(element) => true}
            allowedElements={['div', 'p', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'ol', 'ul', 'li', 'strong', 'a']}
        >
            {processedContent}
        </ReactMarkdown>
    );
};

export const UserMarkdown = memo(
    NonMemoUserMarkdown,
    (prevProps, nextProps) => prevProps.children === nextProps.children,
);

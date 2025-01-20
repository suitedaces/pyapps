'use client'

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import { BundledLanguage, createHighlighter } from 'shiki'

// Base styles that don't change with theme
const markdownStyles = `
    [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:space-y-2
    [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:space-y-2
    [&_li>ul]:list-disc [&_li>ul]:ml-6 [&_li>ul]:mt-2 [&_li>ul]:space-y-2
    [&_li>ol]:list-decimal [&_li>ol]:ml-6 [&_li>ol]:mt-2 [&_li>ol]:space-y-2
    [&_li]:pl-2

    [&]:w-full [&]:max-w-full [&]:overflow-hidden
    
    [&_pre]:relative [&_pre]:my-2 [&_pre]:rounded-lg
    [&_pre]:bg-transparent
    [&_pre]:border dark:[&_pre]:border-neutral-800
    [&_pre]:w-full [&_pre]:overflow-x-auto
    
    [&_.shiki]:!bg-transparent [&_.shiki]:w-full
    [&_.shiki-container]:w-full [&_.shiki-container]:px-4 [&_.shiki-container]:py-3
    [&_.shiki-container]:overflow-x-auto [&_.shiki-container]:bg-white dark:[&_.shiki-container]:bg-transparent
    [&_.shiki-container]:min-w-0 [&_.shiki-container]:max-w-full [&_.shiki-container]:rounded-lg
    [&_.shiki-container]:text-black dark:[&_.shiki-container]:text-neutral-100

    [&_code:not(pre code)]:bg-neutral-200 dark:[&_code:not(pre code)]:bg-transparent
    [&_code:not(pre code)]:text-neutral-800 dark:[&_code:not(pre code)]:text-neutral-200
    [&_code:not(pre code)]:rounded [&_code:not(pre code)]:px-1.5 [&_code:not(pre code)]:py-0.5
    [&_code:not(pre code)]:border dark:[&_code:not(pre code)]:border-neutral-600

    [&_a]:text-blue-500 [&_a]:underline hover:[&_a]:text-blue-400
    [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-700 [&_blockquote]:pl-4 [&_blockquote]:italic
    [&_table]:border-collapse [&_table]:w-full
    [&_th]:border [&_th]:border-neutral-800 [&_th]:p-2 [&_th]:bg-neutral-900
    [&_td]:border [&_td]:border-neutral-800 [&_td]:p-2
`

export const assistantMarkdownStyles = `
    ${markdownStyles}
    [&_p]:my-2
    space-y-4
`

export const userMarkdownStyles = `
    ${markdownStyles}
    [&_p]:my-0
    [&>*:first-child]:mt-0
    [&>*:last-child]:mb-0
    space-y-2
`

const CODE_THEMES = {
    dark: {
        primary: 'github-dark-high-contrast',
    },
    light: {
        primary: 'github-light',
    },
} as const

let highlighterPromise: Promise<any> | null = null

async function initHighlighter() {
    if (!highlighterPromise) {
        const allThemes = [
            ...Object.values(CODE_THEMES.dark),
            ...Object.values(CODE_THEMES.light),
        ]

        highlighterPromise = createHighlighter({
            themes: allThemes,
            langs: [
                'python', 'typescript', 'javascript', 'jsx', 'tsx', 
                'json', 'bash', 'shell', 'markdown', 'yaml', 
                'dockerfile', 'html', 'css', 'sql'
            ],
        })
    }
    return highlighterPromise
}

async function highlightCode(code: string, lang: string) {
    const highlighter = await initHighlighter()
    try {
        const html = highlighter.codeToHtml(code.trim(), {
            lang: lang as BundledLanguage || 'text',
            themes: {
                light: CODE_THEMES.light.primary,
                dark: CODE_THEMES.dark.primary,
            },
        })

        return html
    } catch (e) {
        console.error('Highlighting error:', e)
        return `<pre><code>${code}</code></pre>`
    }
}

async function processCodeBlocks(content: string) {
    if (!content) return ''
    
    const codeBlockRegex = /```([\w]*)\n([\s\S]*?)```/g
    let processedContent = content
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
        const [block, lang, code] = match
        const highlighted = await highlightCode(code, lang || 'text')
        processedContent = processedContent.replace(block, `<div class="shiki-container">${highlighted}</div>`)
    }

    return processedContent
}

export async function markdownToHtml(content: string) {
    if (!content) return ''

    try {
        const processedContent = await processCodeBlocks(content)
        const file = await unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkRehype, { allowDangerousHtml: true })
            .use(rehypeRaw)
            .use(rehypeStringify)
            .process(processedContent)
        
        return String(file)
    } catch (error) {
        console.error('Error processing markdown:', error)
        return content
    }
}
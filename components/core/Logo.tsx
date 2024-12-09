'use client'

import { cn } from '@/lib/utils'

interface LogoProps {
    collapsed?: boolean
    inverted?: boolean
    className?: string
}

export function Logo({
    collapsed = false,
    inverted = false,
    className,
}: LogoProps) {
    return (
        <div
            className={cn(
                'relative font-mono font-bold tracking-tighter',
                className
            )}
        >
            <style jsx>{`
                @keyframes blink {
                    0%,
                    100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0;
                    }
                }
                .cursor {
                    animation: blink 1s step-end infinite;
                    margin-left: -0.1em;
                }
                .app {
                    margin-left: 0.3em;
                    transition: opacity 0.2s ease;
                }
            `}</style>
            <span
                className={cn(
                    'text-2xl',
                    inverted ? 'text-black dark:text-white' : 'text-white dark:text-black'
                )}
            >
                py_
            </span>
            <span
                className={cn(
                    'cursor absolute text-2xl',
                    inverted ? 'text-black dark:text-white' : 'text-white dark:text-black'
                )}
            >
                |
            </span>
            {!collapsed && (
                <span className="app text-gray-500 text-2xl">apps</span>
            )}
        </div>
    )
}

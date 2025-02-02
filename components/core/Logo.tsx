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
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes glitter {
                    0%, 100% { 
                        opacity: 0; 
                        transform: scale(0.8) rotate(0deg);
                        filter: blur(0px);
                    }
                    50% { 
                        opacity: 1; 
                        transform: scale(1.2) rotate(180deg);
                        filter: blur(1px);
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
                .star {
                    position: absolute;
                    width: 5px;
                    height: 5px;
                    background: #FFD700;
                    box-shadow: 0 0 4px #FFD700;
                    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
                    opacity: 0;
                }
                .star:nth-child(1) {
                    right: -0.5em;
                    top: 0.2em;
                    animation: glitter 2s ease-in-out infinite;
                }
                .star:nth-child(2) {
                    right: -0.2em;
                    bottom: 0.3em;
                    animation: glitter 2s ease-in-out infinite 0.3s;
                }
                .star:nth-child(3) {
                    right: 0.8em;
                    top: -0.2em;
                    animation: glitter 2s ease-in-out infinite 0.7s;
                }
            `}</style>
            <span
                className={cn(
                    'text-2xl',
                    inverted
                        ? 'text-black dark:text-white'
                        : 'text-white dark:text-black'
                )}
            >
                py_
            </span>
            <span
                className={cn(
                    'cursor absolute text-2xl',
                    inverted
                        ? 'text-black dark:text-white'
                        : 'text-white dark:text-black'
                )}
            >
                |
            </span>
            {!collapsed && (
                <span className="app relative text-gray-400 font-normal text-2xl">
                    apps
                    <div className="star" />
                    <div className="star" />
                    <div className="star" />
                </span>
            )}
        </div>
    )
}

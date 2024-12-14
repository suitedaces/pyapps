'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const spring = {
    type: 'spring',
    stiffness: 700,
    damping: 30,
    duration: 0.5,
}

interface ThemeSwitcherButtonProps {
    showLabel?: boolean
}

export const ThemeSwitcherButton = ({
    showLabel = true,
}: ThemeSwitcherButtonProps) => {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleThemeChange = (newTheme: string) => {
        setTheme(newTheme)
    }

    // Prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="flex items-center justify-between gap-4">
                {showLabel && (
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        Theme
                    </span>
                )}
                <div className="relative flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:bg-neutral-800">
                    <div className="h-6 w-[72px]" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-between gap-4">
            {showLabel && (
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Theme
                </span>
            )}
            <div className="relative flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:bg-neutral-800">
                <motion.div
                    className="absolute h-6 w-6 rounded bg-white dark:bg-neutral-700"
                    layout
                    transition={spring}
                    initial={false}
                    animate={{
                        left:
                            theme === 'light'
                                ? '4px'
                                : theme === 'dark'
                                  ? 'calc(33.33% + 2px)'
                                  : 'calc(66.66% + 0px)',
                    }}
                />
                {['light', 'dark', 'system'].map((t) => (
                    <motion.button
                        key={t}
                        layout
                        transition={spring}
                        onClick={() => handleThemeChange(t)}
                        className={cn(
                            'relative z-10 flex h-6 w-6 items-center justify-center rounded'
                        )}
                        aria-label={`Switch to ${t} theme`}
                    >
                        {t === 'light' && (
                            <Sun className="h-4 w-4 text-neutral-900 dark:text-neutral-100" />
                        )}
                        {t === 'dark' && (
                            <Moon className="h-4 w-4 text-neutral-900 dark:text-neutral-100" />
                        )}
                        {t === 'system' && (
                            <Monitor className="h-4 w-4 text-neutral-900 dark:text-neutral-100" />
                        )}
                    </motion.button>
                ))}
            </div>
        </div>
    )
}

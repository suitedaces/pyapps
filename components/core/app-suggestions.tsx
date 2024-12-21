'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Code2, LineChart, Brain, Database } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppSuggestionProps {
    onSelect: (suggestion: string) => void
    isVisible: boolean
}

const suggestions = [
    {
        icon: <LineChart className="w-4 h-4 mr-2" />,
        text: "Dashboard",
        prompt: "Create a dashboard to visualize my data with interactive charts"
    },
    {
        icon: <Brain className="w-4 h-4 mr-2" />,
        text: "ML Model",
        prompt: "Build an app to train and test machine learning models"
    },
    {
        icon: <Database className="w-4 h-4 mr-2" />,
        text: "Data Cleaner",
        prompt: "Create a tool to clean and preprocess my data"
    },
    {
        icon: <Code2 className="w-4 h-4 mr-2" />,
        text: "Time Series",
        prompt: "Build an app to analyze and forecast time series data"
    }
]

export default function AppSuggestions({ onSelect, isVisible }: AppSuggestionProps) {
    if (!isVisible) return null;

    const handleSuggestionClick = (suggestion: string) => {
        onSelect(suggestion)
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex justify-center gap-4 w-full"
        >
            {suggestions.map((suggestion, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                >
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            "flex items-center gap-2",
                            "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                            "border border-border hover:bg-accent hover:text-accent-foreground",
                            "dark:bg-background/40 dark:hover:bg-background/60",
                            "shadow-sm hover:shadow transition-all"
                        )}
                        onClick={() => handleSuggestionClick(suggestion.prompt)}
                    >
                        {suggestion.icon}
                        {suggestion.text}
                    </Button>
                </motion.div>
            ))}
        </motion.div>
    )
} 
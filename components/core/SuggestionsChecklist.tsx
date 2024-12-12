'use client'

import { Check } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useState } from "react"

interface SuggestionsChecklistProps {
    metrics: string[]
    onMetricToggle: (metric: string, checked: boolean) => void
}

export function SuggestionsChecklist({ metrics, onMetricToggle }: SuggestionsChecklistProps) {
    const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set())

    const handleToggle = (metric: string, checked: boolean) => {
        setSelectedMetrics(prev => {
            const newSet = new Set(prev)
            if (checked) {
                newSet.add(metric)
            } else {
                newSet.delete(metric)
            }
            return newSet
        })
        onMetricToggle(metric, checked)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg border border-border bg-background/50 backdrop-blur-sm"
        >
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground">
                Suggested Metrics
            </h3>
            <div className="space-y-3">
                {metrics.map((metric, index) => (
                    <motion.div
                        key={metric}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center space-x-2"
                    >
                        <Checkbox
                            id={`metric-${index}`}
                            checked={selectedMetrics.has(metric)}
                            onCheckedChange={(checked) => handleToggle(metric, checked as boolean)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <Label
                            htmlFor={`metric-${index}`}
                            className={cn(
                                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                                selectedMetrics.has(metric) && "text-primary"
                            )}
                        >
                            {metric}
                        </Label>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
} 
import { Circle } from 'lucide-react'
import React from 'react'

interface CircularProgressProps {
    size?: number
    strokeWidth?: number
    percentage: number
    color?: string
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
    size = 24,
    strokeWidth = 2,
    percentage,
    color = 'currentColor',
}) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (percentage / 100) * circumference

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <Circle
                size={size}
                className="text-gray-200"
                strokeWidth={strokeWidth}
            />
            <svg
                className="absolute top-0 left-0 transform -rotate-90"
                width={size}
                height={size}
            >
                <circle
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                {Math.round(percentage)}%
            </div>
        </div>
    )
}

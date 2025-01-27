import { cn } from "@/lib/utils"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({ className, size = 'md', ...props }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12'
    }

    return (
        <div className="flex items-center justify-center" {...props}>
            <div
                className={cn(
                    "animate-spin rounded-full border-2 border-current border-t-transparent text-foreground",
                    sizeClasses[size],
                    className
                )}
            >
                <span className="sr-only">Loading...</span>
            </div>
        </div>
    )
} 
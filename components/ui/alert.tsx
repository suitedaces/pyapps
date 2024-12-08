import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { XCircle } from "lucide-react"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }


interface AlertMessageProps {
    title?: string
    message: string
    variant?: 'default' | 'destructive'
    className?: string
    onDismiss?: () => void
}

export function AlertMessage({
    title,
    message,
    variant = 'default',
    className,
    onDismiss
}: AlertMessageProps) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
            >
                <Alert 
                    variant={variant}
                    className={cn(
                        "border shadow-lg",
                        variant === 'destructive' ? 'bg-red-50' : 'bg-white',
                        "relative cursor-pointer",
                        className
                    )}
                    onClick={onDismiss}
                >
                    {title && <AlertTitle>{title}</AlertTitle>}
                    <div className="flex items-center gap-2">
                        {variant === 'destructive' && (
                            <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <AlertDescription className={cn(
                            "text-sm",
                            variant === 'destructive' ? 'text-red-600' : 'text-gray-600'
                        )}>
                            {message}
                        </AlertDescription>
                    </div>
                </Alert>
            </motion.div>
        </AnimatePresence>
    )
}
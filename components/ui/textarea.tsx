import { cn } from '@/lib/utils'
import * as React from 'react'
import { BorderTrail } from '../core/border-trail'

const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
    return (
        <div className="relative w-full rounded-md border-2 border-neutral-200 dark:border-dark-textAreaBorder">
            <textarea
                className={cn(
                    'flex min-h-[80px] w-full bg-white px-3 py-2 text-base ring-offset-white',
                    'placeholder:text-neutral-500',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'dark:bg-dark-app dark:text-dark-text dark:ring-offset-dark-app',
                    'dark:placeholder:text-neutral-400',
                    'dark:focus-visible:ring-neutral-300',
                    className
                )}
                ref={ref}
                {...props}
            />
            <BorderTrail
                style={{
                    boxShadow:
                        '0px 0px 60px 30px rgb(255 255 255 / 50%), 0 0 100px 60px rgb(0 0 0 / 50%), 0 0 140px 90px rgb(0 0 0 / 50%)',
                }}
                size={100}
            />
        </div>
    )
})
Textarea.displayName = 'Textarea'

export { Textarea }

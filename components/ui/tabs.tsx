'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'

import * as React from 'react'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            'inline-flex h-12 items-center justify-center rounded-2xl p-1.5',
            'bg-foreground dark:bg-darkBg',
            'border border-bordern dark:border-darkBorder',
            className
        )}
        {...props}
    />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2',
            'text-sm font-medium transition-all focus-visible:outline-none',
            'text-text dark:text-darkText disabled:pointer-events-none disabled:opacity-50',
            'hover:bg-black/5 dark:hover:bg-white/5',
            'data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10',
            'data-[state=active]:text-text dark:data-[state=active]:text-darkText',
            className
        )}
        {...props}
    />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            'mt-4 ring-offset-white focus-visible:outline-none',
            'rounded-2xl border border-bordern dark:border-darkBorder',
            'bg-foreground dark:bg-darkBg p-4',
            className
        )}
        {...props}
    />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsContent, TabsList, TabsTrigger }

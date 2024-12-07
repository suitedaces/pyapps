'use client'

import { Loader2 } from 'lucide-react'

export function LoadingSandbox() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading sandbox...</p>
      </div>
    </div>
  )
} 
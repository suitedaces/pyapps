import { X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { ScrollArea } from './ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { motion, AnimatePresence } from 'framer-motion'

interface FilePreviewProps {
  file: File
  onRemove: () => void
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const [preview, setPreview] = useState<string>('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const text = await file.text()
        setPreview(text)
      } catch (error) {
        console.error('Error reading file:', error)
        setPreview('Error loading file preview')
      }
    }

    if (file) {
      loadPreview()
    }
  }, [file])

  const isPreviewable = (file: File) => {
    const previewableTypes = [
      'text/csv',
      'text/plain',
      'application/json',
      '.csv',
      '.txt',
      '.json'
    ]
    return previewableTypes.some(type =>
      file.type === type || file.name.toLowerCase().endsWith(type)
    )
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 dark:bg-slate-900 rounded-t-xl border-x border-t"
        >
          <div className="p-2 pb-7">
            <motion.div
              className="relative bg-white dark:bg-slate-800 rounded-lg border p-3 w-44 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => isPreviewable(file) && setIsPreviewOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Close button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="absolute -right-1.5 -top-1.5 p-1 rounded-full bg-white dark:bg-slate-800 border shadow-sm text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </motion.button>

              {/* File info - centered layout */}
              <div className="flex flex-col items-center gap-1.5">
                {/* File name */}
                <div className="text-center">
                  <span className="text-sm font-medium line-clamp-2 text-center">
                    {file.name}
                  </span>
                </div>

                {/* File size */}
                <span className="text-xs text-muted-foreground">
                  {Math.round(file.size / 1024)}KB
                </span>

                {/* File type */}
                <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded w-full text-center">
                  {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh] text-black">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Preview:</span>
              <span className="font-normal text-muted-foreground">{file.name}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 h-[calc(80vh-100px)] mt-4 border rounded-md bg-slate-100">
            <div className="p-4">
              {preview ? (
                <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                  {preview}
                </pre>
              ) : (
                <div className="text-center text-muted-foreground">
                  Loading preview...
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}

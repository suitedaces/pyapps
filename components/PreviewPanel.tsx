import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Code, Globe, RefreshCcw } from 'lucide-react'
import { CodeView } from './CodeView'
import { StreamlitPreview } from './StreamlitPreview'

interface PreviewPanelProps {
    streamlitUrl: string | null
    generatedCode: string
    isGeneratingCode: boolean
    showCodeView: boolean
    onRefresh: () => void
    onCodeViewToggle: () => void
}

export function PreviewPanel({
    streamlitUrl,
    generatedCode,
    isGeneratingCode,
    showCodeView,
    onRefresh,
    onCodeViewToggle,
}: PreviewPanelProps) {
    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 p-2 border-b bg-muted/40">
                <div className="flex items-center flex-grow gap-2 px-2 py-1.5 bg-background rounded-md border shadow-sm">
                    <Globe className="h-4 w-4 text-foreground/90" />
                    <Input 
                        value={streamlitUrl || ''} 
                        readOnly 
                        className="flex-grow font-mono text-sm border-0 focus-visible:ring-0 px-0 py-0 h-auto bg-transparent text-foreground selection:bg-blue-200"
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRefresh}
                    className="hover:bg-background"
                    title="Refresh App"
                    disabled={isGeneratingCode}
                >
                    <RefreshCcw className={cn(
                        "h-4 w-4 text-foreground/90",
                        isGeneratingCode && "animate-spin"
                    )} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onCodeViewToggle}
                    className={cn(
                        "hover:bg-background",
                        showCodeView && "bg-background text-primary"
                    )}
                    title={showCodeView ? "Show App" : "Show Code"}
                >
                    <Code className="h-4 w-4 text-foreground/90" />
                </Button>
            </div>
            <div className="flex-grow relative">
                {showCodeView ? (
                    <div className="h-full overflow-auto">
                        <CodeView 
                            code={generatedCode} 
                            isGeneratingCode={isGeneratingCode}
                        />
                    </div>
                ) : (
                    <StreamlitPreview
                        url={streamlitUrl}
                        isGeneratingCode={isGeneratingCode}
                        onRefresh={onRefresh}
                        onToggleCode={onCodeViewToggle}
                        showCode={showCodeView}
                    />
                )}
            </div>
        </div>
    )
}

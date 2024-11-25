import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Code, Settings, RefreshCw, ExternalLink, MonitorPlay, Plus, X } from 'lucide-react'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { 
    Tooltip, 
    TooltipContent, 
    TooltipTrigger,
    TooltipProvider 
} from '@/components/ui/tooltip'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useSandbox } from '@/contexts/SandboxContext'
import type { SandboxState } from '@/contexts/SandboxContext'

interface EnvVar {
    name: string;
    value: string;
}

interface StreamlitPreviewProps {
    onRerun?: () => Promise<void>;
    code?: string;
}

interface AppToolbarProps {
    sandbox: SandboxState;
    showCode: boolean;
    setShowCode: (show: boolean) => void;
    onRerun: () => Promise<void>;
}

const AppToolbar = ({ sandbox, showCode, setShowCode, onRerun }: AppToolbarProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [envVars, setEnvVars] = useState<EnvVar[]>([])
    const { updateEnvVars } = useSandbox()

    const handleEnvVarChange = (index: number, field: 'name' | 'value', value: string) => {
        setEnvVars(prev => {
            const newVars = [...prev]
            newVars[index] = { ...newVars[index], [field]: value }
            return newVars
        })
    }

    const handleSave = async () => {
        const varsRecord = envVars.reduce((acc, { name, value }) => {
            if (name?.trim()) acc[name] = value || ''
            return acc
        }, {} as Record<string, string>)
        
        await updateEnvVars(varsRecord)
        setIsOpen(false)
    }

    const addNewVar = () => setEnvVars(prev => [...prev, { name: '', value: '' }])
    const removeVar = (index: number) => setEnvVars(prev => prev.filter((_, i) => i !== index))

    return (
        <TooltipProvider>
            <div className="flex items-center gap-2 p-2 border-b bg-gray-50/80 backdrop-blur-sm sticky top-0">
                <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border shadow-sm">
                        <Input 
                            value={sandbox.url || ''} 
                            readOnly 
                            className="border-0 bg-transparent focus-visible:ring-0 px-0 font-mono text-sm selection:bg-black/10"
                        />
                        {sandbox.url && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <a href={sandbox.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4 text-gray-500 hover:text-gray-700 transition-colors" />
                                    </a>
                                </TooltipTrigger>
                                <TooltipContent>Open in new tab</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={onRerun}
                                className="hover:bg-black/5"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rerun app</TooltipContent>
                    </Tooltip>
                </div>

                <div className="flex items-center gap-1">
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon"
                                className="hover:bg-black/5"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="space-y-4">
                                <div className="font-medium">Environment Variables</div>
                                <div className="space-y-2">
                                    {envVars.map((envVar, index) => (
                                        <div key={index} className="flex gap-2">
                                            <Input
                                                placeholder="Name"
                                                value={envVar.name}
                                                onChange={e => handleEnvVarChange(index, 'name', e.target.value)}
                                            />
                                            <Input
                                                placeholder="Value"
                                                value={envVar.value}
                                                onChange={e => handleEnvVarChange(index, 'value', e.target.value)}
                                            />
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => removeVar(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={addNewVar}
                                        className="w-full"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Variable
                                    </Button>
                                </div>
                                <Button 
                                    onClick={handleSave}
                                    className="w-full bg-black hover:bg-black/90 text-white"
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setShowCode(!showCode)}
                                className="hover:bg-black/5"
                            >
                                {showCode ? <MonitorPlay className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{showCode ? 'Show app' : 'Show code'}</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </TooltipProvider>
    )
}

export function StreamlitPreview({ 
    onRerun,
    code,
}: StreamlitPreviewProps) {
    const { sandbox } = useSandbox()
    const [showCode, setShowCode] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRerun = async () => {
        try {
            setIsRefreshing(true)
            await onRerun?.()
        } finally {
            setIsRefreshing(false)
        }
    }

    return (
        <div className="relative h-full flex flex-col">
            {sandbox.isGenerating && (
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Executing code...</span>
                    </div>
                </div>
            )}

            {sandbox.error && (
                <div className="absolute top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-md">
                    {sandbox.error}
                </div>
            )}

            <Card className="bg-white border-border h-full max-h-[82vh] flex-grow">
                <AppToolbar 
                    sandbox={sandbox}
                    showCode={showCode}
                    setShowCode={setShowCode}
                    onRerun={handleRerun}
                />
                <CardContent className="p-0 h-[calc(100%-48px)] relative">
                    {showCode ? (
                        <div className="h-full overflow-auto">
                            <SyntaxHighlighter
                                language="python"
                                style={atomDark}
                                customStyle={{
                                    margin: 0,
                                    borderRadius: 0,
                                    minHeight: '100%'
                                }}
                            >
                                {sandbox.code || code || ''}
                            </SyntaxHighlighter>
                        </div>
                    ) : (
                        <div className="h-full overflow-auto">
                            {sandbox.isGenerating ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-text" />
                                        <p className="text-sm text-text">
                                            Generating Streamlit app...
                                        </p>
                                    </div>
                                </div>
                            ) : isRefreshing ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-text" />
                                        <p className="text-sm text-text">
                                            Refreshing app...
                                        </p>
                                    </div>
                                </div>
                            ) : sandbox.url ? (
                                <iframe
                                    key={sandbox.url}
                                    src={sandbox.url}
                                    className="w-full h-full border-0"
                                    allow="accelerometer; camera; gyroscope; microphone"
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-sm text-text">No Streamlit app available</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

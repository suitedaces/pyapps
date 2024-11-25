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

interface EnvVar {
    name: string;
    value: string;
}

interface StreamlitPreviewProps {
    onRerun?: () => Promise<void>;
    onEnvVarsChange?: (vars: Record<string, string>) => Promise<void>;
}

export function StreamlitPreview({ 
    onRerun,
    onEnvVarsChange 
}: StreamlitPreviewProps) {
    const { sandbox, rerunCode, updateEnvVars } = useSandbox()
    const [showCode, setShowCode] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [envVars, setEnvVars] = useState<EnvVar[]>([])
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleEnvVarChange = (index: number, field: 'name' | 'value', value: string) => {
        setEnvVars(prev => {
            const newVars = [...prev]
            newVars[index] = {
                ...newVars[index],
                [field]: value
            }
            return newVars
        })
    }

    const handleSave = async () => {
        const varsRecord = envVars.reduce((acc, { name, value }) => {
            if (name?.trim()) {
                acc[name] = value || ''
            }
            return acc
        }, {} as Record<string, string>)
        
        await updateEnvVars(varsRecord)
        await onEnvVarsChange?.(varsRecord)
        setIsOpen(false)
    }

    const addNewVar = () => {
        setEnvVars(prev => [...prev, { name: '', value: '' }])
    }

    const removeVar = (index: number) => {
        setEnvVars(prev => prev.filter((_, i) => i !== index))
    }

    const handleRerun = async () => {
        try {
            setIsRefreshing(true)
            await rerunCode()
            await onRerun?.()
        } finally {
            setIsRefreshing(false)
        }
    }

    const AppToolbar = () => (
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
                                onClick={handleRerun}
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
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        className="hover:bg-black/5"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Environment variables</TooltipContent>
                        </Tooltip>
                        <PopoverContent 
                            className="w-96" 
                            align="end"
                            side="bottom"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium">Environment Variables</h4>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={addNewVar}
                                        className="h-7 text-xs"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Variable
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {envVars.map((envVar, idx) => (
                                        <div key={idx} className="space-y-2 p-3 rounded-lg bg-gray-50">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs text-gray-500">
                                                    Variable {idx + 1}
                                                </Label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeVar(idx)}
                                                    className="h-6 w-6 p-0 hover:text-red-600"
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <Input
                                                        placeholder="NAME"
                                                        defaultValue={envVar.name}
                                                        onChange={(e) => handleEnvVarChange(idx, 'name', e.target.value)}
                                                        className="h-7 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Input
                                                        placeholder="Value"
                                                        defaultValue={envVar.value}
                                                        onChange={(e) => handleEnvVarChange(idx, 'value', e.target.value)}
                                                        className="h-7 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button
                                        onClick={handleSave}
                                        className="bg-black hover:bg-black/90 text-white"
                                    >
                                        Save Changes
                                    </Button>
                                </div>
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
                                {showCode ? (
                                    <MonitorPlay className="h-4 w-4" />
                                ) : (
                                    <Code className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {showCode ? 'Show app' : 'Show code'}
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </TooltipProvider>
    )

    // Show code even when waiting for URL
    if (sandbox.code && !sandbox.url) {
        return (
            <Card className="bg-white border-border h-full">
                <AppToolbar />
                <CardContent className="p-0 h-full">
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
                                {sandbox.code}
                            </SyntaxHighlighter>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-text" />
                                <p className="text-sm text-text">
                                    Loading Streamlit app...
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    // Main render with both code and iframe available
    return (
        <Card className="bg-white border-border h-full max-h-[82vh] flex-grow">
            <AppToolbar />
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
                            {sandbox.code}
                        </SyntaxHighlighter>
                    </div>
                ) : (
                    <div className="h-full overflow-auto streamlit-container">
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
                                        Loading Streamlit app...
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
            <style jsx global>{`
                .streamlit-container {
                    height: 100%;
                }
                .streamlit-container::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .streamlit-container::-webkit-scrollbar-track {
                    background: #E5E6E9;
                }
                .streamlit-container::-webkit-scrollbar-thumb {
                    background: #212121;
                    border-radius: 4px;
                }
                .streamlit-container::-webkit-scrollbar-thumb:hover {
                    background: #1b1b1b;
                }
                .streamlit-container {
                    scrollbar-width: thin;
                    scrollbar-color: #212121 #E5E6E9;
                }
            `}</style>
        </Card>
    )
}

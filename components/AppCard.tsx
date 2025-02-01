import { Card, CardContent, CardHeader } from "@/components/ui/card"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Share2, ExternalLink, Copy, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Link from "next/link"

// X (Twitter) icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
    </svg>
  );
}

interface AppCardProps {
    name: string
    description: string | null
    updatedAt: string
    id: string
    userId: string
    currentVersionNumber?: number
}

export function AppCard({ name, description, updatedAt, id, userId, currentVersionNumber }: AppCardProps) {
    const [imageError, setImageError] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    useEffect(() => {
        async function fetchPresignedUrl() {
            if (!currentVersionNumber) return;
            
            try {
                const response = await fetch(`/api/apps/${id}/${currentVersionNumber}/screenshot?userId=${userId}`);
                if (!response.ok) throw new Error('Failed to get presigned URL');
                const data = await response.json();
                setImageUrl(data.url);
            } catch (error) {
                console.error('Error fetching presigned URL:', error);
                setImageError(true);
            }
        }
        
        fetchPresignedUrl();
    }, [id, currentVersionNumber, userId]);

    const getDaysAgo = (date: string) => {
        const days = Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 3600 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        return `${days} days ago`;
    };

    const handleCopy = async (e?: Event | React.MouseEvent) => {
        if (e) e.preventDefault();
        const url = `${window.location.origin}/apps/${id}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTwitterShare = (e: Event | React.MouseEvent) => {
        e.preventDefault();
        const url = `${window.location.origin}/apps/${id}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=Look what I just cooked 🔥%0A%0A"${name}" on PyApps:%0A%0A${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank');
    };

    return (
        <Card className="transition-all duration-200 hover:shadow-lg hover:bg-accent/50 overflow-hidden">
            <div className="aspect-video relative bg-muted">
                {imageUrl && !imageError && (
                    <Image
                        src={imageUrl}
                        alt={`Preview of ${name}`}
                        fill
                        className="object-cover"
                        priority={false}
                        onError={() => {
                            console.log('Failed to load image:', imageUrl);
                            setImageError(true);
                        }}
                    />
                )}
            </div>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <Link href={`/apps/${id}`} className="hover:underline">
                        <h3 className="font-semibold leading-none tracking-tight">{name}</h3>
                    </Link>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <button className="p-1 hover:bg-accent rounded-md">
                                    <Share2 className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem 
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleCopy();
                                    }} 
                                    className="gap-2"
                                >
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    {copied ? "copied!" : "share link"}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTwitterShare(e);
                                    }} 
                                    className="gap-2"
                                >
                                    <XIcon className="h-4 w-4" />
                                    tweet
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <a 
                                        href={`/apps/${id}`} 
                                        target="_blank" 
                                        className="p-1 hover:bg-accent rounded-md"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </TooltipTrigger>
                                <TooltipContent>Open in new tab</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <p className="text-xs text-muted-foreground">{getDaysAgo(updatedAt)}</p>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {description || 'No description'}
                </p>
            </CardHeader>
        </Card>
    )
} 
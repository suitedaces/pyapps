import { Card, CardContent, CardHeader } from "@/components/ui/card"
import Image from "next/image"
import { useEffect, useState } from "react"

interface AppCardProps {
    name: string
    description: string | null
    updatedAt: string
    onClick?: () => void
    id: string
    userId: string
    currentVersionNumber?: number
}

export function AppCard({ name, description, updatedAt, onClick, id, userId, currentVersionNumber }: AppCardProps) {
    const [imageError, setImageError] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    
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

    return (
        <Card 
            className="cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:bg-accent/50 overflow-hidden"
            onClick={onClick}
        >
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
                    <h3 className="font-semibold leading-none tracking-tight">{name}</h3>
                    <p className="text-sm text-muted-foreground">{updatedAt}</p>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {description || 'No description'}
                </p>
            </CardContent>
        </Card>
    )
} 
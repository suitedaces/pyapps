import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface AppCardProps {
    name: string
    description: string | null
    updatedAt: string
    onClick?: () => void
}

export function AppCard({ name, description, updatedAt, onClick }: AppCardProps) {
    return (
        <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={onClick}
        >
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
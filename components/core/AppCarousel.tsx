import { motion, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from "@/components/ui/card"
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'
import Image from 'next/image'

type AppRow = Database['public']['Tables']['apps']['Row']
type AppVersion = Database['public']['Tables']['app_versions']['Row']

export interface DemoApp extends AppRow {
    currentVersion?: AppVersion
}

const DEMO_APP_IDS = [
    '4ad17bcb-7a7a-4640-800a-041a68231008',
    'c8634d56-8884-4dca-8109-3bdf4c7f848a',
    'f7f7fa92-93be-42bf-8ae1-7cf5fc280750',
    'da15f9eb-28c1-4d67-becf-396a0e43d11d'
]

interface AppCarouselProps {
    onAppSelect?: (app: DemoApp) => void
}

const AppCard = ({ app }: { app: DemoApp }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [imageError, setImageError] = useState(false)

    useEffect(() => {
        async function fetchPresignedUrl() {
            if (!app.currentVersion?.version_number) return
            
            try {
                const response = await fetch(`/api/apps/${app.id}/${app.currentVersion.version_number}/screenshot?userId=${app.user_id}`)
                if (!response.ok) throw new Error('Failed to get presigned URL')
                const data = await response.json()
                setImageUrl(data.url)
            } catch (error) {
                console.error('Error fetching presigned URL:', error)
                setImageError(true)
            }
        }
        
        fetchPresignedUrl()
    }, [app.id, app.currentVersion?.version_number, app.user_id])

    return (
        <motion.div
            className={cn(
                'w-[180px] overflow-hidden rounded-lg',
                'bg-white dark:bg-card',
                'shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
                'hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_4px_8px_-2px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_4px_8px_-2px_rgba(0,0,0,0.1)]',
                'cursor-pointer transition-all duration-200'
            )}
            whileHover={{ 
                scale: 1.02,
                transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
        >
            <div className="relative bg-gray-50 dark:bg-gray-900 aspect-video">
                {imageUrl && !imageError ? (
                    <Image
                        src={imageUrl}
                        alt={`Preview of ${app.name}`}
                        fill
                        className="object-cover"
                        priority={false}
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900" />
                )}
            </div>
            <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium text-xs leading-none tracking-tight text-gray-800 dark:text-gray-200">{app.name}</h3>
                </div>
            </CardHeader>
        </motion.div>
    )
}

export default function AppCarousel({ onAppSelect }: AppCarouselProps) {
    const [isHovered, setIsHovered] = useState(false)
    const [demoApps, setDemoApps] = useState<DemoApp[]>([])
    const controls = useAnimation()

    useEffect(() => {
        const fetchDemoApps = async () => {
            const supabase = createClient()
            
            const { data: apps, error } = await supabase
                .from('apps')
                .select(`
                    *,
                    currentVersion:app_versions!fk_current_version(*)
                `)
                .in('id', DEMO_APP_IDS)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Error fetching demo apps:', error)
                return
            }

            const transformedApps: DemoApp[] = apps?.map(app => ({
                ...app,
                currentVersion: Array.isArray(app.currentVersion) ? app.currentVersion[0] : app.currentVersion
            })) || []

            setDemoApps(transformedApps)
        }

        fetchDemoApps()
    }, [])

    useEffect(() => {
        if (isHovered) {
            controls.stop()
        } else {
            controls.start({
                x: [0, -1920],
                transition: {
                    duration: 30,
                    ease: "linear",
                    repeat: Infinity,
                }
            })
        }
    }, [isHovered, controls])

    if (demoApps.length === 0) return null

    const duplicatedApps = [...demoApps, ...demoApps, ...demoApps]

    return (
        <div 
            className="w-full overflow-hidden bg-transparent flex items-center relative z-30"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
            
            <motion.div
                className="flex gap-3"
                animate={controls}
                initial={{ x: 0 }}
            >
                {duplicatedApps.map((app, i) => (
                    <div
                        key={`${app.id}-${i}`}
                        className="inline-flex"
                        onClick={() => onAppSelect?.(app)}
                    >
                        <AppCard app={app} />
                    </div>
                ))}
            </motion.div>

            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />
        </div>
    )
}
import { motion, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from "@/components/ui/card"
import { useState, useEffect, useRef } from 'react'
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
    const [isHovered, setIsHovered] = useState(false)

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
        <div className="relative">
            <motion.div
                className={cn(
                    'w-[140px] sm:w-[180px] overflow-hidden rounded-xl',
                    'bg-white dark:bg-card',
                    'shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
                    'hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_4px_8px_-2px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_4px_8px_-2px_rgba(0,0,0,0.1)]',
                    'cursor-pointer transition-all duration-300'
                )}
                style={{
                    zIndex: isHovered ? 40 : 30,
                    position: 'relative'
                }}
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                animate={{ 
                    scale: isHovered ? 1.05 : 1,
                    transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
            >
                <div className="relative bg-white dark:bg-card aspect-[16/10]">
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
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800/50 dark:to-gray-900/50" />
                    )}
                </div>
                <CardHeader className="py-2 sm:py-2.5 px-3 sm:px-4 bg-white dark:bg-card">
                    <h3 className="font-medium text-xs sm:text-sm leading-none tracking-tight text-gray-800 dark:text-gray-200">
                        {app.name}
                    </h3>
                </CardHeader>

                {/* Full Card Description Overlay */}
                <motion.div 
                    className="absolute inset-0 flex items-center justify-center rounded-xl"
                    initial={false}
                    animate={{ 
                        opacity: isHovered ? 1 : 0
                    }}
                    transition={{
                        duration: 0.2
                    }}
                >
                    <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-[2px] rounded-xl" />
                    <div className="relative w-full h-full flex items-center justify-center">
                        <p className="px-3 py-2 text-[10px] sm:text-xs text-neutral-700 dark:text-neutral-300 line-clamp-[8] text-center">
                            {app.description || 'No description available'}
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    )
}

export default function AppCarousel({ onAppSelect }: AppCarouselProps) {
    const [isHovered, setIsHovered] = useState(false)
    const [demoApps, setDemoApps] = useState<DemoApp[]>([])
    const controls = useAnimation()

    // Start animation as soon as we have apps
    useEffect(() => {
        if (demoApps.length > 0) {
            controls.start({
                x: [0, -960],
                transition: {
                    duration: 20,
                    ease: "linear",
                    repeat: Infinity,
                }
            })
        }
    }, [demoApps, controls])

    // Handle hover pause/resume
    useEffect(() => {
        if (isHovered) {
            controls.stop()
        } else if (demoApps.length > 0) {
            controls.start({
                x: [0, -960],
                transition: {
                    duration: 20,
                    ease: "linear",
                    repeat: Infinity,
                }
            })
        }
    }, [isHovered, demoApps, controls])

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

    if (demoApps.length === 0) return null

    const duplicatedApps = [...demoApps, ...demoApps, ...demoApps]

    return (
        <div 
            className="w-full bg-transparent relative z-30"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="overflow-hidden relative">
                <div className="flex items-center">
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-8 sm:w-12 lg:w-24 bg-gradient-to-r from-background via-background/50 to-transparent",
                        "transition-opacity duration-300 z-[35]",
                        isHovered ? "opacity-0" : "opacity-100"
                    )} />
                    
                    <motion.div
                        className="flex gap-3 sm:gap-4 lg:gap-8 relative z-30"
                        animate={controls}
                        initial={{ x: 0 }}
                        style={{ paddingInline: "1rem" }}
                    >
                        {duplicatedApps.map((app, i) => (
                            <div
                                key={`${app.id}-${i}`}
                                className="inline-flex relative"
                                style={{ 
                                    minWidth: '140px'
                                }}
                                onClick={() => onAppSelect?.(app)}
                            >
                                <AppCard app={app} />
                            </div>
                        ))}
                    </motion.div>

                    <div className={cn(
                        "absolute right-0 top-0 bottom-0 w-8 sm:w-12 lg:w-24 bg-gradient-to-l from-background via-background/50 to-transparent",
                        "transition-opacity duration-300 z-[35]",
                        isHovered ? "opacity-0" : "opacity-100"
                    )} />
                </div>
            </div>
        </div>
    )
}
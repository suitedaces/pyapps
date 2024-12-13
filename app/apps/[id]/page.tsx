import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { Logo } from '@/components/core/Logo'
import { ThemeSwitcherButton } from '@/components/ui/theme-button-switcher'
import { Button } from '@/components/ui/button'
import { RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageParams {
    params: Promise<{ id: string }>
}

export default async function AppPage({ params }: PageParams) {
    const { id } = await params
    const user = await getUser()
    
    const supabase = await createClient()

    // Fetch app and its current version
    const { data: app, error } = await supabase
        .from('apps')
        .select(`
            *,
            app_versions!inner (
                code,
                version_number,
                created_at
            )
        `)
        .eq('id', id)
        .eq('app_versions.id', 'apps.current_version_id')
        .single()

    if (error || !app) {
        console.error('Error fetching app:', error)
        notFound()
    }

    // Initialize sandbox
    const sandboxResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sandbox/${id}/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            code: app.app_versions[0].code
        })
    })

    if (!sandboxResponse.ok) {
        console.error('Failed to initialize sandbox')
        notFound()
    }

    const chatResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chats/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!chatResponse.ok) {
        console.error('Failed to fetch chat')
        notFound()
    }

    const { url: sandboxUrl } = await sandboxResponse.json()

    return (
        <ThemeProvider>
            <div className="min-h-screen flex flex-col bg-white dark:bg-dark-app">
                {/* Header with branding and theme toggle */}
                <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-dark-app z-50">
                    <div className="h-full px-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Logo inverted={false} />
                            <div className="hidden sm:block">
                                <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                    {app.name}
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                                <RefreshCcw className="h-4 w-4" />
                            </Button>
                            <ThemeSwitcherButton />
                        </div>
                    </div>
                </header>

                {/* Full screen iframe */}
                <main className="flex-1">
                    <iframe
                        src={sandboxUrl}
                        className="w-full h-full border-0"
                        allow="camera"
                    />
                </main>
            </div>
        </ThemeProvider>
    )
}
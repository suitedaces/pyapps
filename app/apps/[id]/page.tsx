import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { Logo } from '@/components/core/Logo'
import { ThemeSwitcherButton } from '@/components/ui/theme-button-switcher'
import { Button } from '@/components/ui/button'
import { RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VersionSelector } from '@/components/VersionSelector'
import { AppHeader } from '@/components/AppHeader'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { StreamlitFrame } from '@/components/StreamlitFrame'

interface PageParams {
    params: Promise<{ id: string }>
}

export default async function AppPage({ params }: PageParams) {
    const { id } = await params
    const user = await getUser()
    
    if (!user) {
        notFound()
    }

    const supabase = await createClient()

    const { data: app, error } = await supabase
        .rpc('get_app_versions', { p_app_id: id })
        .select()

    if (error || !app || app.length === 0) {
        console.error('Error fetching app:', error?.message)
        notFound()
    }

    // Get auth token for sandbox request
    const cookieStore = await cookies()
    const supabaseToken = cookieStore.get('sb-token')?.value

    // Initialize sandbox with auth
    const sandboxResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sandbox/new/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseToken}`,
            'Cookie': cookieStore.getAll()
                .map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`)
                .join('; ')
        },
        body: JSON.stringify({
            code: app[0].code
        })
    })

    if (!sandboxResponse.ok) {
        console.error('Failed to initialize sandbox:', await sandboxResponse.text())
        return <div>Failed to load app. Please try again later.</div>
    }

    const { url: sandboxUrl } = await sandboxResponse.json()

    return (
        <ThemeProvider>
            <div className="min-h-screen flex flex-col bg-white dark:bg-dark-app">
                <AppHeader
                    appId={id}
                    appName={app[0].name ?? ''}
                    initialVersions={app}
                />
                <main className="flex-1">
                    <StreamlitFrame url={sandboxUrl} />
                </main>
            </div>
        </ThemeProvider>
    )
}
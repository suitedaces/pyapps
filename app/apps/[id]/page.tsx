import { createClient, getUser } from '@/lib/supabase/server'
import { AppVersion } from '@/lib/types'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { AppClient } from './AppClient'

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

    // Get the app data
    const { data: app, error } = await supabase
        .rpc('get_app_versions', { p_app_id: id })
        .select()

    if (error || !app || app.length === 0) {
        console.error('Error fetching app:', error?.message)
        notFound()
    }

    // Get all cookies for proper authentication
    const cookieStore = await cookies()
    const cookieHeader = cookieStore
        .getAll()
        .map((cookie: any) => `${cookie.name}=${cookie.value}`)
        .join('; ')

    // Initialize sandbox with proper auth headers
    const sandboxResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/sandbox/new/execute`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookieHeader,
            },
            body: JSON.stringify({
                code: app[0].code,
            }),
        }
    )

    if (!sandboxResponse.ok) {
        console.error(
            'Failed to initialize sandbox:',
            await sandboxResponse.text()
        )
        return <div>Failed to load app. Please try again later.</div>
    }

    const { url: sandboxUrl } = await sandboxResponse.json()

    return (
        <AppClient app={app[0] as AppVersion} sandboxUrl={sandboxUrl} id={id} />
    )
}

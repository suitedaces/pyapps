import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { AppClient } from './AppClient'
import { AppVersion } from '@/lib/types'

interface PageParams {
    params: { id: string }
}

export default async function AppPage({ params }: PageParams) {
    const { id } = params
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

    return <AppClient app={app[0] as AppVersion} sandboxUrl={sandboxUrl} id={id} />
}
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

    // let it handle the sandbox initialization using the store
    return <AppClient app={app[0] as AppVersion} id={id} />
}

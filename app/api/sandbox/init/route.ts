import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Sandbox } from '@e2b/code-interpreter'
import { SandboxMetadata } from '@/lib/sandbox'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Track initializations per user
const initializationMap = new Map<string, Promise<NextResponse>>()

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json(
            { error: 'Not authenticated' },
            { status: 401 }
        )
    }

    const userId = session.user.id

    try {
        // Check for existing initialization
        if (initializationMap.has(userId)) {
            const existingPromise = initializationMap.get(userId)
            if (existingPromise) {
                return existingPromise
            }
        }

        // Create new initialization promise
        const initPromise = (async () => {
            try {
                // Check for existing sandbox
                const userSandbox = await Sandbox.list().then(sandboxes => sandboxes.find(
                    sandbox => sandbox.metadata?.userId === userId
                ))
                if (userSandbox) {
                    console.log('Found existing sandbox for user:', userId)
                    return NextResponse.json({ 
                        sandboxId: userSandbox.sandboxId,
                        isExisting: true 
                    })
                }

                // Create new sandbox with metadata
                const metadata: SandboxMetadata = {
                    userId,
                    createdAt: new Date().toISOString()
                }

                const sandbox = await Sandbox.create({
                    apiKey: process.env.E2B_API_KEY,
                    metadata
                })
                await sandbox.files.makeDir('/app')

                // Get user's latest file if any
                const { data: files } = await supabase
                    .from('files')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                if (files?.content_hash) {
                    await sandbox.files.write(
                        `/app/${files.file_name}`,
                        files.content_hash
                    )
                }

                return NextResponse.json({ 
                    sandboxId: sandbox.sandboxId,
                    isNew: true 
                })
            } finally {
                initializationMap.delete(userId)
            }
        })()

        initializationMap.set(userId, initPromise)
        return initPromise
    } catch (error) {
        initializationMap.delete(userId)
        console.error('Error initializing sandbox:', error)
        return NextResponse.json(
            { error: 'Failed to initialize sandbox' },
            { status: 500 }
        )
    }
}

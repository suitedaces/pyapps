import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const page = Number(searchParams.get('page')) || 1
        const limit = Number(searchParams.get('limit')) || 15
        const offset = (page - 1) * limit
        const search = searchParams.get('search') || ''

        const supabase = createRouteHandlerClient({ cookies })
        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            )
        }

        // Get total count
        const countQuery = await supabase
            .from('chats')
            .select('*', { count: 'exact' })
            .eq('user_id', session.user.id)
            .ilike('name', search ? `%${search}%` : '%')

        const count = countQuery.count || 0

        // Get paginated results
        const { data: chats, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', session.user.id)
            .ilike('name', search ? `%${search}%` : '%')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Database error:', error)
            throw error
        }

        // Format the response
        const formattedChats =
            chats?.map((chat) => ({
                id: chat.id,
                name: chat.name || `Chat ${chat.id.slice(0, 8)}`,
                created_at: chat.created_at,
                last_message: chat.last_message,
                app_id: chat.app_id,
            })) || []

        return NextResponse.json({
            chats: formattedChats,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        })
    } catch (error) {
        console.error('Error in conversations route:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch conversations',
                details:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            )
        }

        const { name, appId } = await req.json()

        const { data, error } = await supabase
            .from('chats')
            .insert({
                user_id: session.user.id,
                name,
                app_id: appId,
                created_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            console.error('Database error:', error)
            return NextResponse.json(
                {
                    error: 'Failed to create conversation',
                    details: error.message,
                },
                { status: 500 }
            )
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error in POST conversations:', error)
        return NextResponse.json(
            {
                error: 'Failed to create conversation',
                details:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}

import { runNotebook } from '@/lib/jupyterInterpreter'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const { code } = await req.json()

    try {
        const results = await runNotebook(code)

        return NextResponse.json({ results })
    } catch (error) {
        console.error('Error running Jupyter Notebook:', error)
        return NextResponse.json(
            { error: 'Failed to run Jupyter Notebook' },
            { status: 500 }
        )
    }
}
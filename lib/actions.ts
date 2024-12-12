// lib/actions.ts
"use server"

import { createStreamableValue, StreamableValue } from 'ai/rsc'
let globalStreamable: StreamableValue<string, any> | null = null
const streamable = createStreamableValue('')

export async function generate(): Promise<StreamableValue<string, any>> {
    console.log('📍 Generate called - Stream State:', {
        hasExistingStream: !!globalStreamable,
        timestamp: new Date().toISOString()
    })

    globalStreamable = streamable.value

    console.log('🚀 New Stream Created:', {
        timestamp: new Date().toISOString(),
        streamId: Math.random().toString(36).slice(2)
    })

    return streamable.value
}

export async function updateToolDelta(delta: string) {
    if (!globalStreamable) {
        console.log('🔄 Creating new stream as previous was invalid')
        await generate()
    }

    if (globalStreamable) {
        try {

            await streamable.update(delta)

            console.log('✅ Stream Updated:', {
                deltaLength: delta.length,
                lastChunk: delta
            })
            return true
        } catch (error) {
            console.error('❌ Error updating stream:', error)
            return false
        }
    }

    console.warn('⚠️ No active stream found for update')
    return false
}

export async function completeToolStream() {
    if (globalStreamable) {
        try {
            const finalValue = await streamable.value
            streamable.done()

            console.log('✅ Stream Completed:', {
                finalLength: finalValue,
                timestamp: new Date().toISOString()
            })

            globalStreamable = null
        } catch (error) {
            console.error('❌ Error completing stream:', error)
        }
    } else {
        console.warn('⚠️ No stream to complete')
    }
}

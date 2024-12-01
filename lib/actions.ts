"use server"

import { createStreamableValue, readStreamableValue, StreamableValue } from 'ai/rsc'

let globalStreamable: StreamableValue<string> | null = null
const streamable = createStreamableValue('')

export async function generate(): Promise<StreamableValue<string>> {
    console.log('📍 Generate called - Stream State:', {
        hasExistingStream: !!globalStreamable,
        timestamp: new Date().toISOString()
    })

    // Create new streamable
    globalStreamable = streamable.value

    console.log('🚀 New Stream Created:', {
        timestamp: new Date().toISOString(),
        streamId: Math.random().toString(36).slice(2) // For debugging
    })

    return streamable.value
}

export async function updateToolDelta(delta: string) {
    if (!streamable.value) {
        console.log('🔄 Creating new stream as previous was invalid')
        await generate()
    }

    if (streamable.value) {
        try {
            // Wait for the current value to resolve
            const currentValue = await streamable.value

            // Ensure we have a string
            const currentString = String(currentValue || '')
            const newValue = currentString + delta

            await streamable.update(newValue)

            console.log('✅ Stream Updated:', {
                currentLength: currentString.length,
                deltaLength: delta.length,
                newLength: newValue.length,
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
    console.log('🏁 Completing Tool Stream:', {
        timestamp: new Date().toISOString(),
        hasStream: !!globalStreamable
    })

    if (globalStreamable) {
        try {
            const finalValue = await streamable.value
            streamable.done()
            console.log('✅ Stream Completed:', {
                finalLength: finalValue,
                content: finalValue
            })
            globalStreamable = null
        } catch (error) {
            console.error('❌ Error completing stream:', error)
        }
    } else {
        console.warn('⚠️ No stream to complete')
    }
}

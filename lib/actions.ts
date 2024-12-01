// lib/actions.ts
"use server"

import { createAI, createStreamableValue, StreamableValue } from 'ai/rsc'

type StreamableValueWrapper<T, E> = {
    /**
     * The value of the streamable. This can be returned from a Server Action and
     * received by the client. To read the streamed values, use the
     * `readStreamableValue` or `useStreamableValue` APIs.
     */
    readonly value: StreamableValue<T, E>;
    /**
     * This method updates the current value with a new one.
     */
    update(value: T): StreamableValueWrapper<T, E>;
    /**
     * This method is used to append a delta string to the current value. It
     * requires the current value of the streamable to be a string.
     *
     * @example
     * ```jsx
     * const streamable = createStreamableValue('hello');
     * streamable.append(' world');
     *
     * // The value will be 'hello world'
     * ```
     */
    append(value: T): StreamableValueWrapper<T, E>;
    /**
     * This method is used to signal that there is an error in the value stream.
     * It will be thrown on the client side when consumed via
     * `readStreamableValue` or `useStreamableValue`.
     */
    error(error: any): StreamableValueWrapper<T, E>;
    /**
     * This method marks the value as finalized. You can either call it without
     * any parameters or with a new value as the final state.
     * Once called, the value cannot be updated or appended anymore.
     *
     * This method is always **required** to be called, otherwise the response
     * will be stuck in a loading state.
     */
    done(...args: [T] | []): StreamableValueWrapper<T, E>;
};

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
            const currentValue = await streamable.value
            const newValue = currentValue + delta

            await streamable.update(newValue)

            console.log('✅ Stream Updated:', {
                currentLength: currentValue,
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

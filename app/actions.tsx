"use server"

import { createStreamableValue, StreamableValue } from "ai/rsc"

let globalStreamable: Promise<StreamableValue<string, any>>
const toolDelta = createStreamableValue()

export const toolStream = async (streamValue: string) => {

    toolDelta.update(streamValue)

    return {
        stream: toolDelta.value,
    }
}

export async function generate(): Promise<StreamableValue<string, any>> {
    globalStreamable = Promise.resolve(toolDelta.value)
    return globalStreamable
}

// export const generate = async () => {
//     const streambableValue = toolDelta.value
//     return streambableValue
// }

export const toolDone = async () => {
    toolDelta.done()
}

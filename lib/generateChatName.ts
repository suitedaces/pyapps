// pages/api/generate-chat-name.ts
import type { NextApiRequest, NextApiResponse } from 'next' // Adjust the import path as needed
import { generateChatName } from './tools'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' })
    }

    try {
        const chatName = await generateChatName()
        res.status(200).json({ name: chatName })
    } catch (error) {
        console.error('Error generating chat name:', error)
        res.status(500).json({ message: 'Failed to generate chat name' })
    }
}

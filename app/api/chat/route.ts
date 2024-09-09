import { NextRequest } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'
import { Anthropic } from '@anthropic-ai/sdk'
import { GruntyAgent } from '@/lib/agent'
import { tools } from '@/lib/tools'
import { analyzeCSV } from '@/lib/csvAnalyzer'
import { CSVAnalysis, StreamChunk } from '@/lib/types'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const agent = new GruntyAgent(
  anthropic,
  "claude-3-5-sonnet-20240620",
  "AI Assistant",
  CHAT_SYSTEM_PROMPT
)

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages, csvContent, csvFileName, chatId } = await request.json()

  let csvAnalysis: CSVAnalysis | undefined
  if (csvContent) {
    csvAnalysis = await analyzeCSV(csvContent, chatId)
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const chatGenerator = agent.chat(
          chatId,
          messages[messages.length - 1].content,
          tools,
          0.7,
          4000,
          csvAnalysis
        )

        let accumulatedResponse = ''
        let generatedCode = ''

        for await (const chunk of chatGenerator) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'))

          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            accumulatedResponse += chunk.delta.text
          } else if (chunk.type === 'generated_code' && 'content' in chunk) {
            generatedCode += chunk.content
          }

          if (chunk.type === 'message_stop') {
            await prisma.message.create({
              data: {
                chatId,
                role: 'assistant',
                content: accumulatedResponse,
              },
            })

            if (generatedCode) {
              const app = await prisma.streamlitApp.upsert({
                where: { chatId },
                update: {},
                create: { chatId, name: 'Generated App' },
              })

              const newVersion = await prisma.streamlitAppVersion.create({
                data: {
                  appId: app.id,
                  code: generatedCode,
                  versionNumber: (await prisma.streamlitAppVersion.count({ where: { appId: app.id } })) + 1,
                },
              })

              await prisma.streamlitApp.update({
                where: { id: app.id },
                data: { currentVersionId: newVersion.id },
              })
            }
          }
        }

        controller.close()
      } catch (error) {
        console.error('Error in stream processing:', error)
        controller.enqueue(new TextEncoder().encode(JSON.stringify({
          type: 'error',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        } as StreamChunk) + '\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export const runtime = 'edge'
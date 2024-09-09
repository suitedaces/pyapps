import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'
import { Sandbox } from 'e2b'

const SANDBOX_LIFETIME = 5 * 60 * 1000 // 5 minutes
const sandboxes = new Map<string, Sandbox>()

async function getSandbox(chatId: string): Promise<Sandbox> {
  const existingSandbox = await prisma.sandbox.findUnique({ where: { chatId } })

  if (existingSandbox) {
    if (sandboxes.has(existingSandbox.id)) {
      const sandbox = sandboxes.get(existingSandbox.id)!
      await sandbox.keepAlive(SANDBOX_LIFETIME)
      return sandbox
    } else {
      try {
        const sandbox = await Sandbox.reconnect({ sandboxID: existingSandbox.id })
        await sandbox.keepAlive(SANDBOX_LIFETIME)
        sandboxes.set(existingSandbox.id, sandbox)
        return sandbox
      } catch (error) {
        console.error('Error connecting to existing sandbox:', error)
      }
    }
  }

  // Create a new sandbox if we don't have one or couldn't connect to the existing one
  const newSandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    template: "streamlit-sandbox-me"
  })

  await newSandbox.filesystem.makeDir('/app')
  await newSandbox.keepAlive(SANDBOX_LIFETIME)
  sandboxes.set(newSandbox.id, newSandbox)

  // Update or create the sandbox record in the database
  await prisma.sandbox.upsert({
    where: { chatId },
    update: { id: newSandbox.id },
    create: { id: newSandbox.id, chatId, userId: await getUserId(chatId) },
  })

  return newSandbox
}

async function getUserId(chatId: string): Promise<string> {
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { userId: true } })
  if (!chat) throw new Error('Chat not found')
  return chat.userId
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { action, code, fileName, fileContent, chatId } = await request.json()

  if (!chatId) {
    return NextResponse.json({ error: 'ChatId is required' }, { status: 400 })
  }

  try {
    let sandbox: Sandbox

    switch (action) {
      case 'initialize':
        sandbox = await getSandbox(chatId)
        return NextResponse.json({ sandboxId: sandbox.id })

      case 'close':
        const sandboxToClose = await prisma.sandbox.findUnique({ where: { chatId } })
        if (sandboxToClose) {
          const sandbox = sandboxes.get(sandboxToClose.id)
          if (sandbox) {
            await sandbox.close()
            sandboxes.delete(sandboxToClose.id)
          }
          await prisma.sandbox.delete({ where: { id: sandboxToClose.id } })
        }
        return NextResponse.json({ message: 'Sandbox closed successfully' })

      case 'updateCode':
        sandbox = await getSandbox(chatId)
        console.log('Updating code in sandbox:', code)
        await sandbox.filesystem.write('/app/app.py', code)
        const process = await sandbox.process.start({
          cmd: "streamlit run /app/app.py",
          onStdout: console.log,
          onStderr: console.error,
        })
        console.log('Streamlit process started')
        const url = sandbox.getHostname(8501)
        console.log('Streamlit URL:', url)

        const app = await prisma.streamlitApp.findUnique({ where: { id: chatId } })
        if (app) {
          await prisma.streamlitAppVersion.create({
            data: {
              appId: app.id,
              code,
              versionNumber: (await prisma.streamlitAppVersion.count({ where: { appId: app.id } })) + 1,
            }
          })
        }

        return NextResponse.json({ url: 'https://' + url })

      case 'uploadFile':
        sandbox = await getSandbox(chatId)
        console.log('Uploading file to sandbox:', fileName)
        const uploadedPath = `/app/${fileName}`
        await sandbox.filesystem.write(uploadedPath, fileContent)
        console.log('File uploaded successfully to:', uploadedPath)

        await prisma.file.create({
          data: {
            chatId,
            name: fileName,
            path: uploadedPath,
            content: fileContent,
          }
        })

        return NextResponse.json({ path: uploadedPath })

      case 'getUrl':
        sandbox = await getSandbox(chatId)
        const streamlitUrl = sandbox.getHostname(8501)
        return NextResponse.json({ url: 'https://' + streamlitUrl })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in sandbox operation:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Sandbox operation failed: ${errorMessage}` }, { status: 500 })
  }
}
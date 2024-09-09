import { NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if the user exists in the User table
    const user = await prisma.user.findUnique({
      where: { id: session.user.sub },
    });

    if (!user) {
      // If the user doesn't exist, return an error or create the user
      return NextResponse.json({ error: 'User does not exist' }, { status: 404 });
    }

    // Find or create a chat for the user
    const chat = await prisma.chat.upsert({
      where: {
        id: await prisma.chat
          .findFirst({ where: { userId: session.user.sub } })
          .then((chat) => chat?.id ?? 'new-chat-id'),
      },
      update: {}, // If found, don't update anything
      create: {
        userId: session.user.sub,
      },
    });

    // Fetch the most recent messages for this chat
    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to the last 50 messages, adjust as needed
    });

    return NextResponse.json({
      chatId: chat.id,
      messages: messages.reverse(), // Reverse to get chronological order
    });
  } catch (error) {
    console.error('Error initializing chat:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  methods: ['POST'],
};

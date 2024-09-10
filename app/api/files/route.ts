import { NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getSupabaseUserId, uploadFile, getUserFiles, deleteFile } from '@/lib/supabase';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { fileName, fileType, fileSize, fileUrl, analysis } = await req.json();

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    const file = await uploadFile(supabaseUserId, fileName, fileType, fileSize, fileUrl, analysis);
    return NextResponse.json(file);
  } catch (error) {
    console.error('Failed to upload file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    const files = await getUserFiles(supabaseUserId);
    return NextResponse.json(files);
  } catch (error) {
    console.error('Failed to fetch files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { fileId } = await req.json();

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    await deleteFile(fileId, supabaseUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
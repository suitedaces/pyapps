import { NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { supabase, getSupabaseUserId, createApp, getUserApps, updateApp, deleteApp } from '@/lib/supabase';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    const apps = await getUserApps(supabaseUserId);
    return NextResponse.json(apps);
  } catch (error) {
    console.error('Failed to fetch apps:', error);
    return NextResponse.json({ error: 'Failed to fetch apps' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { name, description } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'App name is required' }, { status: 400 });
  }

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    const newApp = await createApp(supabaseUserId, name, description);
    return NextResponse.json(newApp);
  } catch (error) {
    console.error('Failed to create app:', error);
    return NextResponse.json({ error: 'Failed to create app' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { appId, updates } = await req.json();

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    const updatedApp = await updateApp(appId, supabaseUserId, updates);
    return NextResponse.json(updatedApp);
  } catch (error) {
    console.error('Failed to update app:', error);
    return NextResponse.json({ error: 'Failed to update app' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { appId } = await req.json();

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    await deleteApp(appId, supabaseUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete app:', error);
    return NextResponse.json({ error: 'Failed to delete app' }, { status: 500 });
  }
}
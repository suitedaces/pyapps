import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createApp, getUserApps, updateApp, deleteApp } from '@/lib/supabase';


export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const apps = await getUserApps(userId);
    return NextResponse.json(apps);
  } catch (error) {
    console.error('Failed to fetch apps:', error);
    return NextResponse.json({ error: 'Failed to fetch apps' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { name, description } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'App name is required' }, { status: 400 });
  }

  try {
    const userId = session.user.id;
    const newApp = await createApp(userId, name, description);
    return NextResponse.json(newApp);
  } catch (error) {
    console.error('Failed to create app:', error);
    return NextResponse.json({ error: 'Failed to create app' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { appId, updates } = await req.json();

  try {
    const userId = session.user.id;
    const updatedApp = await updateApp(appId, userId, updates);
    return NextResponse.json(updatedApp);
  } catch (error) {
    console.error('Failed to update app:', error);
    return NextResponse.json({ error: 'Failed to update app' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { appId } = await req.json();

  try {
    const userId = session.user.id;
    await deleteApp(appId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete app:', error);
    return NextResponse.json({ error: 'Failed to delete app' }, { status: 500 });
  }
}

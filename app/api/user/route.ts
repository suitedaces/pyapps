import { NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getUserProfile, updateUserProfile, getSupabaseUserId } from '@/lib/supabase';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const userProfile = await getUserProfile(session.user.sub!);
    return NextResponse.json(userProfile);
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { updates } = await req.json();

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    const updatedProfile = await updateUserProfile(supabaseUserId, updates);
    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
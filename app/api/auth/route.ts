import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { action, email, password, provider } = await request.json();

  switch (action) {
    case 'signUp':
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        return NextResponse.json({ error: signUpError.message }, { status: 400 });
      }
      return NextResponse.json({ user: signUpData.user });

    case 'signIn':
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        return NextResponse.json({ error: signInError.message }, { status: 400 });
      }
      return NextResponse.json({ user: signInData.user });

    case 'signOut':
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        return NextResponse.json({ error: signOutError.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });

    case 'getSession':
      const { data: sessionData } = await supabase.auth.getSession();
      return NextResponse.json({ session: sessionData.session });

    case 'getUser':
      const { data: userData } = await supabase.auth.getUser();
      return NextResponse.json({ user: userData.user });

    case 'resetPassword':
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });

    case 'updatePassword':
      const { error: updatePasswordError } = await supabase.auth.updateUser({
        password: password,
      });
      if (updatePasswordError) {
        return NextResponse.json({ error: updatePasswordError.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });

    case 'signInWithProvider':
      const { data: providerData, error: providerError } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
      });
      if (providerError) {
        return NextResponse.json({ error: providerError.message }, { status: 400 });
      }
      return NextResponse.json({ url: providerData.url });

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'getSession':
      const { data: sessionData } = await supabase.auth.getSession();
      return NextResponse.json({ session: sessionData.session });

    case 'getUser':
      const { data: userData } = await supabase.auth.getUser();
      return NextResponse.json({ user: userData.user });

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
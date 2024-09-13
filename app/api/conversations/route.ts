import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name, appId } = await req.json();

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: session.user.id, name, app_id: appId })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

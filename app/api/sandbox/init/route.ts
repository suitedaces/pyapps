import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "e2b";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      template: "streamlit-sandbox-me",
    });

    await sandbox.filesystem.makeDir("/app");
    await sandbox.keepAlive(5 * 60 * 1000); // 5 minutes

    return NextResponse.json({ sandboxId: sandbox.id });
  } catch (error) {
    console.error("Error initializing sandbox:", error);
    return NextResponse.json(
      { error: "Failed to initialize sandbox" },
      { status: 500 },
    );
  }
}

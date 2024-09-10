import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Sandbox } from 'e2b';
import { createAppVersion } from '@/lib/supabase';
import { NextRequest } from 'next/server';

const SANDBOX_LIFETIME = 5 * 60 * 1000; // 5 minutes
const sandboxes = new Map<string, Sandbox>();

async function getSandbox(id?: string): Promise<Sandbox> {
  if (id && sandboxes.has(id)) {
    const sandbox = sandboxes.get(id)!;
    await sandbox.keepAlive(SANDBOX_LIFETIME);
    return sandbox;
  }

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    template: "streamlit-sandbox-me"
  });

  await sandbox.filesystem.makeDir('/app');
  await sandbox.keepAlive(SANDBOX_LIFETIME);
  sandboxes.set(sandbox.id, sandbox);

  return sandbox;
}

export async function POST(request: NextRequest) {
  console.log('POST request received at /api/sandbox');
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.log('User not authenticated');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { action, code, fileName, fileContent, sandboxId } = await request.json();
  console.log('Request payload:', { action, fileName, sandboxId });

  try {
    const userId = session.user.id;
    console.log('User ID:', userId);
    let sandbox: Sandbox;

    switch (action) {
      case 'initialize':
        console.log('Initializing new sandbox');
        sandbox = await getSandbox();
        console.log('New sandbox created with ID:', sandbox.id);
        return NextResponse.json({ sandboxId: sandbox.id });

      case 'close':
        console.log('Attempting to close sandbox:', sandboxId);
        if (sandboxId && sandboxes.has(sandboxId)) {
          const sandboxToClose = sandboxes.get(sandboxId)!;
          await sandboxToClose.close();
          sandboxes.delete(sandboxId);
          console.log('Sandbox closed successfully');
          return NextResponse.json({ message: 'Sandbox closed successfully' });
        }
        console.log('Sandbox not found for closing');
        return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 });

      case 'updateCode':
        console.log('Updating code in sandbox:', sandboxId);
        sandbox = await getSandbox(sandboxId);
        console.log('Updating code in sandbox:', code);
        await sandbox.filesystem.write('/app/app.py', code);
        console.log('Code updated, starting Streamlit process');
        const process = await sandbox.process.start({
          cmd: "streamlit run /app/app.py",
          onStdout: (data) => console.log('Streamlit stdout:', data),
          onStderr: (data) => console.error('Streamlit stderr:', data),
        });
        console.log('Streamlit process started');
        const url = sandbox.getHostname(8501);
        console.log('Streamlit URL:', url);
        
        console.log('Saving new app version');
        await createAppVersion(sandboxId, 1, code, { url });
        console.log('App version saved');
        
        return NextResponse.json({ url: 'https://' + url });

      case 'uploadFile':
        console.log('Uploading file to sandbox:', sandboxId);
        sandbox = await getSandbox(sandboxId);
        console.log('Uploading file:', fileName);
        const uploadedPath = await sandbox.filesystem.write(`/app/${fileName}`, fileContent);
        console.log('File uploaded successfully to:', uploadedPath);
        return NextResponse.json({ path: uploadedPath });

      default:
        console.log('Invalid action received:', action);
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in sandbox operation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('Returning error response');
    return NextResponse.json({ error: `Sandbox operation failed: ${errorMessage}` }, { status: 500 });
  }
}
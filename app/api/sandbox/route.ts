import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from 'e2b';

const SANDBOX_LIFETIME = 5 * 60 * 1000; // Extended to 5 minutes
const sandboxes = new Map<string, Sandbox>();

async function getSandbox(id?: string): Promise<Sandbox> {
  if (id && sandboxes.has(id)) {
    const sandbox = sandboxes.get(id)!;
    await sandbox.keepAlive(SANDBOX_LIFETIME); // Refresh the sandbox lifetime
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
  const { action, code, fileName, fileContent, sandboxId } = await request.json();

  try {
    let sandbox: Sandbox;

    switch (action) {
      case 'initialize':
        sandbox = await getSandbox();
        return NextResponse.json({ sandboxId: sandbox.id });

      case 'close':
        if (sandboxId && sandboxes.has(sandboxId)) {
          const sandboxToClose = sandboxes.get(sandboxId)!;
          await sandboxToClose.close();
          sandboxes.delete(sandboxId);
          return NextResponse.json({ message: 'Sandbox closed successfully' });
        }
        return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 });

      case 'updateCode':
        sandbox = await getSandbox(sandboxId);
        console.log('Updating code in sandbox:', code);
        await sandbox.filesystem.write('/app/app.py', code);
        const process = await sandbox.process.start({
          cmd: "streamlit run /app/app.py",
          onStdout: console.log,
          onStderr: console.error,
        });
        console.log('Streamlit process started');
        const url = sandbox.getHostname(8501);
        console.log('Streamlit URL:', url);
        return NextResponse.json({ url: 'https://' + url });

      case 'uploadFile':
        sandbox = await getSandbox(sandboxId);
        console.log('Uploading file to sandbox:', fileName);
        const uploadedPath = await sandbox.filesystem.write(`/app/${fileName}`, fileContent);
        console.log('File uploaded successfully to:', uploadedPath);
        return NextResponse.json({ path: uploadedPath });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in sandbox operation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Sandbox operation failed: ${errorMessage}` }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}
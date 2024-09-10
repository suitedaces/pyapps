import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { analyzeCSV } from '@/lib/csvAnalyzer';
import { uploadFile } from '@/lib/supabase';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { csvContent, fileName } = await req.json();

  if (!csvContent || !fileName) {
    return NextResponse.json({ error: 'CSV content and file name are required' }, { status: 400 });
  }

  try {
    const userId = session.user.id;
    const analysis = await analyzeCSV(csvContent);

    const file = await uploadFile(
      userId,
      fileName,
      'csv',
      Buffer.from(csvContent).length,
      '', // You might want to store the actual file content in a separate storage service
      analysis
    );

    return NextResponse.json({ file, analysis });
  } catch (error) {
    console.error('Failed to analyze and store CSV:', error);
    return NextResponse.json({ error: 'Failed to analyze and store CSV' }, { status: 500 });
  }
}

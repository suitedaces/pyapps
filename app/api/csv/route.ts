import { NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { analyzeCSV } from '@/lib/csvAnalyzer';
import { getSupabaseUserId, uploadFile } from '@/lib/supabase';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { csvContent, fileName } = await req.json();

  if (!csvContent || !fileName) {
    return NextResponse.json({ error: 'CSV content and file name are required' }, { status: 400 });
  }

  try {
    const supabaseUserId = await getSupabaseUserId(session.user.sub!);
    const analysis = await analyzeCSV(csvContent);

    const file = await uploadFile(
      supabaseUserId,
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
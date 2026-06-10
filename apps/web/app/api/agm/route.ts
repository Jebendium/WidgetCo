// The AGM question queue: GET lists queued questions (most supported first);
// POST upvotes one. The Board answers the popular ones first, which it would
// describe differently.

import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const db = supabase();
  if (!db) return NextResponse.json({ ok: true, questions: [] });
  const { data, error } = await db
    .from('agm_questions')
    .select('id, body, votes')
    .eq('status', 'queued')
    .order('votes', { ascending: false })
    .order('ts')
    .limit(20);
  if (error) {
    return NextResponse.json({ ok: false, error: 'The queue is unavailable.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, questions: data });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let id = 0;
  try {
    const body = (await req.json()) as { id?: unknown };
    id = Number(body.id);
  } catch {
    // validation below
  }
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'A question id is required.' }, { status: 400 });
  }
  const db = supabase();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  const { error } = await db.rpc('upvote_agm_question', { p_id: id });
  if (error) {
    return NextResponse.json({ ok: false, error: 'The vote was not recorded.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: 'Your support has been minuted.' });
}

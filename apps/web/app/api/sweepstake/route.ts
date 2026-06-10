// POST /api/sweepstake { visitorId, date } — one entry per visitor on the
// question the Company prefers not to characterise.

import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/db';
import { isVisitorId } from '@/lib/investor';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let visitorId: unknown;
  let date = '';
  try {
    const body = (await req.json()) as { visitorId?: unknown; date?: unknown };
    visitorId = body.visitorId;
    if (typeof body.date === 'string') date = body.date;
  } catch {
    // validation below
  }

  if (!isVisitorId(visitorId)) {
    return NextResponse.json({ ok: false, error: 'A visitor id is required.' }, { status: 400 });
  }
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    return NextResponse.json({ ok: false, error: 'A date is required (YYYY-MM-DD).' }, { status: 400 });
  }
  if (Date.parse(date) <= Date.now()) {
    return NextResponse.json(
      { ok: false, error: 'The matter, whatever it may be, has not yet arisen. Choose a future date.' },
      { status: 400 },
    );
  }

  const db = supabase();
  if (!db) {
    return NextResponse.json({ ok: false, error: 'The sweepstake is closed.' }, { status: 503 });
  }

  const { error } = await db
    .from('sweepstake')
    .upsert({ visitor_id: visitorId, predicted_date: date }, { onConflict: 'visitor_id' });
  if (error) {
    return NextResponse.json({ ok: false, error: 'Entry could not be recorded.' }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    message: 'Your prediction has been recorded. The Company notes it without comment.',
  });
}

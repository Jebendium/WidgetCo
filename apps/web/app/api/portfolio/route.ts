// GET /api/portfolio?id=<uuid> — fetch (creating on first sight) a visitor's
// notional £10,000 portfolio, valued at the current dealable price.

import { NextResponse, type NextRequest } from 'next/server';
import { getDay, getLatestDay } from '@/lib/data';
import { supabase } from '@/lib/db';
import { currentPrice, isVisitorId } from '@/lib/investor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get('id');
  if (!isVisitorId(id)) {
    return NextResponse.json({ ok: false, error: 'A visitor id is required.' }, { status: 400 });
  }
  const db = supabase();
  if (!db) {
    return NextResponse.json({ ok: false, error: 'The Investor Centre is closed.' }, { status: 503 });
  }

  await db.from('portfolios').upsert({ visitor_id: id }, { onConflict: 'visitor_id', ignoreDuplicates: true });
  const { data, error } = await db
    .from('portfolios')
    .select('cash, shares')
    .eq('visitor_id', id)
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: 'Portfolio unavailable.' }, { status: 500 });
  }
  const row: { cash: number; shares: number } = data;

  const latest = await getLatestDay();
  const file = latest === null ? null : await getDay(latest);
  const price = currentPrice(file, new Date());

  return NextResponse.json({
    ok: true,
    cash: row.cash,
    shares: row.shares,
    price,
    value: row.cash + row.shares * price,
  });
}

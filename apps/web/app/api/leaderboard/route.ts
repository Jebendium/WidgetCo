// GET /api/leaderboard — the top investors by notional worth, anonymised.

import { NextResponse } from 'next/server';
import { getDay, getLatestDay } from '@/lib/data';
import { supabase } from '@/lib/db';
import { currentPrice, investorAlias } from '@/lib/investor';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const db = supabase();
  if (!db) return NextResponse.json({ ok: true, price: 0, leaders: [] });

  const { data, error } = await db
    .from('portfolios')
    .select('visitor_id, cash, shares')
    .limit(500);
  if (error) {
    return NextResponse.json({ ok: false, error: 'Leaderboard unavailable.' }, { status: 500 });
  }
  const rows = data as { visitor_id: string; cash: number; shares: number }[];

  const latest = await getLatestDay();
  const file = latest === null ? null : await getDay(latest);
  const price = currentPrice(file, new Date());

  const leaders = rows
    .map((p) => ({
      alias: investorAlias(p.visitor_id),
      value: p.cash + p.shares * price,
      shares: p.shares,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return NextResponse.json({ ok: true, price, leaders });
}

// POST /api/trade { visitorId, side, shares } — executes atomically in the
// database at the current revealed anchor price. No inference, no impact.

import { NextResponse, type NextRequest } from 'next/server';
import { getDay, getLatestDay } from '@/lib/data';
import { supabase } from '@/lib/db';
import { currentPrice, isVisitorId } from '@/lib/investor';

export const dynamic = 'force-dynamic';

const MAX_SHARES_PER_TRADE = 10_000;

interface TradeRequest {
  visitorId?: unknown;
  side?: unknown;
  shares?: unknown;
}

function parseTrade(body: TradeRequest): { visitorId: string; side: string; shares: number } | null {
  if (!isVisitorId(body.visitorId)) return null;
  if (body.side !== 'buy' && body.side !== 'sell') return null;
  const shares = Number(body.shares);
  if (!Number.isInteger(shares) || shares <= 0 || shares > MAX_SHARES_PER_TRADE) return null;
  return { visitorId: body.visitorId, side: body.side, shares };
}

function refusal(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: TradeRequest = {};
  try {
    body = (await req.json()) as TradeRequest;
  } catch {
    // validation below
  }
  const trade = parseTrade(body);
  if (!trade) return refusal('A valid visitor id, side (buy/sell) and whole number of shares are required.');

  const db = supabase();
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Dealing is suspended.' }, { status: 503 });
  }

  const latest = await getLatestDay();
  const file = latest === null ? null : await getDay(latest);
  const price = currentPrice(file, new Date());

  const res = await db.rpc('execute_trade', {
    p_visitor: trade.visitorId,
    p_side: trade.side,
    p_shares: trade.shares,
    p_price: price,
  });
  const error = res.error;

  if (error) {
    if (error.message.includes('insufficient funds')) {
      return refusal('Insufficient funds. The Company admires your ambition.');
    }
    if (error.message.includes('insufficient shares')) {
      return refusal('You cannot sell shares you do not hold. That would be a different website.');
    }
    return NextResponse.json({ ok: false, error: 'The trade could not be executed.' }, { status: 500 });
  }

  const row = res.data as { cash: number; shares: number };
  return NextResponse.json({ ok: true, cash: row.cash, shares: row.shares, price });
}

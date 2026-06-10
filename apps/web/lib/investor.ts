// Investor Centre logic: execution pricing and visitor-id hygiene.
// Trades execute at the latest REVEALED anchor price — the same price every
// visitor sees on the ticker, with no inference and no market impact, because
// the market maker is a cron and the liquidity is notional.

import { gateAnchors } from './feed';
import type { SimDayFile } from './types';

export const FALLBACK_PRICE_PENCE = 1425;

/** The current dealable price: the latest revealed anchor, else the default. */
export function currentPrice(file: SimDayFile | null, now: Date): number {
  if (!file) return FALLBACK_PRICE_PENCE;
  const revealed = gateAnchors(file.shareAnchors, now);
  const last = revealed[revealed.length - 1];
  return last?.price ?? FALLBACK_PRICE_PENCE;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorId(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** Public display name for a visitor on the leaderboard. */
export function investorAlias(visitorId: string): string {
  return `Investor ${visitorId.slice(0, 8).toUpperCase()}`;
}

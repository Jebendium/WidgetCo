// GET /api/feed?day=N[&mode=replay]
//
// The drip-feed backbone. One fetch returns everything revealed so far plus a
// reveal schedule (ids and times only) so the client can fetch again exactly
// when the next event lands. No polling loops, no websockets, and — hard
// invariant — nothing unrevealed or non-public ever crosses the wire.

import { NextResponse, type NextRequest } from 'next/server';
import { latestDay, readDay } from '@/lib/data';
import { gateAnchors, gateEvents, remapForReplay } from '@/lib/feed';
import type { FeedResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest): NextResponse {
  const params = req.nextUrl.searchParams;
  const dayParam = params.get('day');
  const replay = params.get('mode') === 'replay';

  const day = dayParam !== null ? Number(dayParam) : latestDay();
  if (day === null || !Number.isInteger(day) || day < 1) {
    return NextResponse.json({ error: 'No simulated days available.' }, { status: 404 });
  }

  const file = readDay(day);
  if (!file) {
    return NextResponse.json({ error: `Day ${day} not found.` }, { status: 404 });
  }

  const now = new Date();
  const events = replay ? remapForReplay(file.events, now) : file.events;
  const rawAnchors = replay ? remapForReplay(file.shareAnchors, now) : file.shareAnchors;
  const gated = gateEvents(events, now);
  const anchors = gateAnchors(rawAnchors, now);

  // "Previously on…" recaps the PREVIOUS day. Serving today's recap would
  // narrate events that have not yet revealed (it leaks ahead of ts).
  const previous = readDay(day - 1);
  const recap = previous?.recap ?? 'Series premiere. The kettle is filled for the first time.';

  const body: FeedResponse = {
    day: file.day,
    date: file.date,
    recap,
    serverNow: now.toISOString(),
    events: gated.events,
    upcoming: gated.upcoming,
    anchors,
  };
  return NextResponse.json(body);
}

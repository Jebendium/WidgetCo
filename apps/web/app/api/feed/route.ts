// GET /api/feed?day=N[&mode=replay]
//
// The drip-feed backbone. One fetch returns everything revealed so far plus a
// reveal schedule (ids and times only) so the client can fetch again exactly
// when the next event lands. No polling loops, no websockets, and — hard
// invariant — nothing unrevealed or non-public ever crosses the wire.

import { NextResponse, type NextRequest } from 'next/server';
import { getDay, getLatestDay } from '@/lib/data';
import { gateAnchors, gateEvents, remapForReplay } from '@/lib/feed';
import type { FeedResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Resolve the requested day: explicit param (validated) or the latest. */
async function resolveDay(param: string | null): Promise<number | null> {
  if (param !== null) {
    const n = Number(param);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }
  return getLatestDay();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const replay = params.get('mode') === 'replay';

  const day = await resolveDay(params.get('day'));
  if (day === null) {
    return NextResponse.json({ error: 'No simulated days available.' }, { status: 404 });
  }

  const file = await getDay(day);
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
  const previous = await getDay(day - 1);
  const recap = previous?.recap ?? 'Series premiere. The kettle is filled for the first time.';

  const body: FeedResponse = {
    day: file.day,
    date: file.date,
    recap,
    serverNow: now.toISOString(),
    events: gated.events,
    upcoming: gated.upcoming,
    anchors,
    dialogues: file.dialogues ?? {},
  };
  return NextResponse.json(body);
}

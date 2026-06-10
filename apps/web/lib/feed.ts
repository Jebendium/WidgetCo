// Feed gating — the spec's first testing priority for the web tier:
//   1. events never leak before their scheduled `ts` (not even their payloads);
//   2. `suspicious` flags are never serialised to public payloads;
//   3. non-public events never appear at all.
// Pure functions; the API route is a thin wrapper.

import type {
  PublicAnchor,
  PublicEvent,
  RawSimEvent,
  ShareAnchor,
  UpcomingStub,
} from './types';

/** Convert a raw event into its public shape. Drops suspicious/public flags. */
function toPublicEvent(ev: RawSimEvent): PublicEvent {
  const pub: PublicEvent = {
    id: ev.id,
    day: ev.day,
    ts: ev.ts,
    agentId: ev.agentId,
    kind: ev.kind,
    payload: ev.payload,
  };
  if (ev.interruptible !== undefined) pub.interruptible = ev.interruptible;
  return pub;
}

export interface GatedFeed {
  events: PublicEvent[];
  upcoming: UpcomingStub[];
}

/**
 * Split a day's events into revealed (full public payload) and upcoming
 * (schedule stubs only — id and ts, NEVER the payload). Non-public events
 * appear in neither list.
 */
export function gateEvents(events: RawSimEvent[], now: Date): GatedFeed {
  const revealed: PublicEvent[] = [];
  const upcoming: UpcomingStub[] = [];
  const nowMs = now.getTime();

  for (const ev of events) {
    if (!ev.public) continue;
    const tsMs = Date.parse(ev.ts);
    if (Number.isNaN(tsMs)) continue; // unschedulable: withhold entirely
    if (tsMs <= nowMs) {
      revealed.push(toPublicEvent(ev));
    } else {
      upcoming.push({ id: ev.id, ts: ev.ts });
    }
  }

  revealed.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  upcoming.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return { events: revealed, upcoming };
}

/**
 * Share anchors: only anchors whose moment has passed are served — a future
 * anchor's `cause` describes an event that has not been revealed yet.
 */
export function gateAnchors(anchors: ShareAnchor[], now: Date): PublicAnchor[] {
  const nowMs = now.getTime();
  return anchors
    .filter((a) => {
      const tsMs = Date.parse(a.ts);
      return !Number.isNaN(tsMs) && tsMs <= nowMs;
    })
    .map((a) => ({ ts: a.ts, price: a.price, cause: a.cause }));
}

/**
 * DEV replay mode: remap a sim day's 09:00–17:30 window onto a rolling
 * ten-minute window so the drip feed can be watched live. Works on anything
 * timestamped (events, share anchors). Deterministic within each window
 * block. Returns copies with adjusted `ts`.
 */
export function remapForReplay<T extends { ts: string }>(
  items: T[],
  now: Date,
  windowMs = 10 * 60 * 1000,
): T[] {
  const times = items.map((e) => Date.parse(e.ts)).filter((t) => !Number.isNaN(t));
  if (times.length === 0) return items;

  const dayStart = Math.min(...times);
  const daySpan = Math.max(Math.max(...times) - dayStart, 1);
  const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;

  return items.map((item) => {
    const tsMs = Date.parse(item.ts);
    if (Number.isNaN(tsMs)) return item;
    const frac = (tsMs - dayStart) / daySpan;
    return { ...item, ts: new Date(windowStart + frac * windowMs).toISOString() };
  });
}

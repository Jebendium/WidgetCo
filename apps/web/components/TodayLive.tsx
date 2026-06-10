'use client';

// The drip feed. ONE fetch returns everything revealed so far plus the reveal
// schedule (ids and times only); we set a single timer for the next reveal
// moment and fetch again then. No interval polling, no websockets, and no
// visitor action ever triggers inference — this only reads what the morning
// cron already wrote.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedResponse } from '@/lib/types';
import { EventCard } from './EventCard';
import { Ticker } from './Ticker';

const REVEAL_BUFFER_MS = 750;

export function TodayLive({ replay }: { replay: boolean }) {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/feed${replay ? '?mode=replay' : ''}`);
      if (!res.ok) {
        setError('The feed is unavailable. The Company is aware and a working group has been proposed.');
        return;
      }
      const data = (await res.json()) as FeedResponse;
      setFeed(data);
      setError(null);

      // Schedule one fetch for the next reveal moment, if any.
      const next = data.upcoming[0];
      if (next) {
        const waitMs = Math.max(
          Date.parse(next.ts) - Date.parse(data.serverNow) + REVEAL_BUFFER_MS,
          REVEAL_BUFFER_MS,
        );
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          void load();
        }, waitMs);
      }
    } catch {
      setError('The feed is unavailable. The Company is aware.');
    }
  }, [replay]);

  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  if (error) return <div className="panel">{error}</div>;
  if (!feed) return <div className="panel">Opening the post…</div>;

  const newestFirst = [...feed.events].reverse();

  return (
    <>
      <Ticker anchors={feed.anchors} />
      <div className="recap">
        <h2>Previously, on Amalgamated Widget Holdings…</h2>
        {feed.recap}
      </div>
      <div className="panel">
        <h2>
          Today at the Company — day {feed.day}
          {feed.upcoming.length > 0
            ? ` (${feed.upcoming.length} item${feed.upcoming.length === 1 ? '' : 's'} yet to occur)`
            : ' (close of business)'}
        </h2>
        {newestFirst.length === 0 ? (
          <p className="smallprint">
            Nothing has happened yet today. The kettle has been filled. Trading continues.
          </p>
        ) : (
          newestFirst.map((ev) => <EventCard key={ev.id} ev={ev} />)
        )}
      </div>
    </>
  );
}

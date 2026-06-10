'use client';

// The stage. The office IS the page: full-bleed canvas, a thin ticker bar,
// and slide-out drawers for everything readable, so the visitor's attention
// never leaves the company. One fetch per reveal moment — no polling, no
// websockets, no inference from visitor actions.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useOfficeStore } from '@/lib/office/store';
import type { FeedResponse } from '@/lib/types';
import { DialoguePanel } from './DialoguePanel';
import { Drawer } from './Drawer';
import { EventCard } from './EventCard';
import { Office } from './Office';
import { Ticker } from './Ticker';

const REVEAL_BUFFER_MS = 750;

/** The top tab bar and its slide-down panels: one section open at a time. */
function TopPanels({ sections }: { sections: Record<string, ReactNode> }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <div className="top-tabs">
        {Object.keys(sections).map((name) => (
          <button
            key={name}
            className={open === name ? 'active' : ''}
            onClick={() => {
              setOpen(open === name ? null : name);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className={`top-panel ${open ? 'open' : ''}`}>
        <div className="drawer-controls">
          <button
            onClick={() => {
              setOpen(null);
            }}
            title="Back to the office"
          >
            ✕ back to the office
          </button>
        </div>
        {open && sections[open]}
      </div>
    </>
  );
}

export function TodayLive({
  replay,
  sections = {},
}: {
  replay: boolean;
  sections?: Record<string, ReactNode>;
}) {
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
      // The office acts out what the feed reveals.
      useOfficeStore.getState().ingestEvents(data.events);
      useOfficeStore.getState().spawnForDay(data.day, Date.now());

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

  return (
    <div className="stage">
      <Office />
      <StageOverlays feed={feed} />
      <TopPanels sections={sections} />
    </div>
  );
}

/** Everything layered over the office: ticker, drawers, dialogue. */
function StageOverlays({ feed }: { feed: FeedResponse | null }) {
  return (
    <>
      <div className="ticker-bar">
        {feed && <Ticker anchors={feed.anchors} />}
        {feed && <NextEvent feed={feed} />}
      </div>
      <Drawer side="left" label="Previously on…">
        <h2>Previously, on Amalgamated Widget Holdings…</h2>
        <div className="recap-text">{feed?.recap ?? 'The tape is rewinding…'}</div>
      </Drawer>
      <Drawer side="right" label={`Today — day ${feed?.day ?? '…'}`}>
        <FeedPanel feed={feed} />
      </Drawer>
      <DialoguePanel dialogues={feed?.dialogues ?? {}} />
    </>
  );
}

/** Countdown to the next scheduled reveal — appointment viewing. */
function NextEvent({ feed }: { feed: FeedResponse }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      force((n) => n + 1);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const next = feed.upcoming[0];
  if (!next) return <span className="next-event">close of business</span>;
  const secs = Math.max(0, Math.floor((Date.parse(next.ts) - Date.now()) / 1000));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <span className="next-event">
      next item in {mm}:{ss}
    </span>
  );
}

function upcomingLabel(feed: FeedResponse): string {
  if (feed.upcoming.length === 0) return ' — close of business';
  return ` — ${feed.upcoming.length} item${feed.upcoming.length === 1 ? '' : 's'} yet to occur`;
}

function FeedPanel({ feed }: { feed: FeedResponse | null }) {
  if (!feed) return <p className="smallprint">Opening the post…</p>;
  const newestFirst = [...feed.events].reverse();
  return (
    <>
      <h2>Today at the Company{upcomingLabel(feed)}</h2>
      {newestFirst.length === 0 ? (
        <p className="smallprint">
          Nothing has happened yet today. The kettle has been filled. Trading continues.
        </p>
      ) : (
        newestFirst.map((ev) => <EventCard key={ev.id} ev={ev} />)
      )}
    </>
  );
}

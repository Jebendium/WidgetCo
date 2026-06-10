'use client';

// The share ticker: a deterministic seeded random walk interpolating between
// the day's revealed anchors. Always moving, fully client-side, zero cost.

import { useEffect, useRef, useState } from 'react';
import type { PublicAnchor } from '@/lib/types';

/** Deterministic PRNG — same seed, same walk, on every visitor's machine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FALLBACK_PENCE = 1425; // pre-market: the price the City has settled on

/** The walk value for a given wall-clock second, anchored to the last anchor. */
function priceAt(anchors: PublicAnchor[], second: number): number {
  const base = anchors.length > 0 ? (anchors[anchors.length - 1]?.price ?? FALLBACK_PENCE) : FALLBACK_PENCE;
  // Sum a short window of seeded jitters so the walk wanders but mean-reverts.
  let drift = 0;
  for (let i = 0; i < 8; i++) {
    const rng = mulberry32(second - i);
    drift += (rng() - 0.5) * base * 0.0012 * (1 - i / 8);
  }
  return Math.max(1, Math.round(base + drift));
}

function fmt(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function Ticker({ anchors }: { anchors: PublicAnchor[] }) {
  const [second, setSecond] = useState(() => Math.floor(Date.now() / 1000));
  const history = useRef<number[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecond(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const price = priceAt(anchors, second);
  history.current = [...history.current.slice(-59), price];

  const open = anchors[0]?.price ?? FALLBACK_PENCE;
  const delta = price - open;
  const cause = anchors[anchors.length - 1]?.cause ?? 'Pre-market';

  const points = history.current;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const path = points
    .map((p, i) => `${(i / Math.max(points.length - 1, 1)) * 120},${24 - ((p - min) / span) * 22}`)
    .join(' ');

  return (
    <div className="ticker" title="AWH.L — delayed by convention, not necessity">
      <span className="sym">AWH.L</span>
      <span className="price">{fmt(price)}</span>
      <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
        {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}
      </span>
      <svg width="120" height="26" aria-hidden="true">
        <polyline points={path} fill="none" stroke="#7fd08a" strokeWidth="1" />
      </svg>
      <span className="cause">{cause}</span>
    </div>
  );
}

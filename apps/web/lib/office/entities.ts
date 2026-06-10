// Temporary entities: creatures and manifestations that are not staff. They
// have no tools, no email, and no place on the org chart, which has not
// stopped them appearing. Client-side only — zero inference, pure theatre.

import { WAYPOINTS } from './waypoints';

export interface Entity {
  id: string;
  sprite: 'cat' | 'mirror';
  x: number;
  y: number;
  expiresAt: number;
  frames: number;
  frameMs: number;
  frameW: number;
  frameH: number;
  /** Horizontal patrol velocity, px/s (the cat saunters; the mirror does not). */
  dx: number;
  patrolMin: number;
  patrolMax: number;
}

export const CAT_VISIT_MS = 10 * 60 * 1000;
const KETTLE_POKES_REQUIRED = 3;
const KETTLE_POKE_WINDOW_MS = 30_000;

/** The cat: appears near the kettle, patrols the kitchenette, owes no one. */
export function spawnCat(now: number): Entity {
  return {
    id: `cat-${String(now)}`,
    sprite: 'cat',
    x: WAYPOINTS.kettle.x - 30,
    y: WAYPOINTS.kettle.y + 14,
    expiresAt: now + CAT_VISIT_MS,
    frames: 4,
    frameMs: 260,
    frameW: 16,
    frameH: 16,
    dx: 9,
    patrolMin: WAYPOINTS.kettle.x - 60,
    patrolMax: WAYPOINTS.kettle.x + 40,
  };
}

/** The haunted mirror: manifests on the wall when the disturbances peak. */
export function spawnMirror(now: number, untilEndOfDayMs: number): Entity {
  return {
    id: `mirror-${String(now)}`,
    sprite: 'mirror',
    x: WAYPOINTS.ceo_desk.x - 60,
    y: 64,
    expiresAt: now + untilEndOfDayMs,
    frames: 6,
    frameMs: 320,
    frameW: 16,
    frameH: 32,
    dx: 0,
    patrolMin: 0,
    patrolMax: 0,
  };
}

/** On legendary days, something sits on the roofline across the road. */
export function spawnRoofCreature(now: number): Entity {
  const cat = spawnCat(now);
  return { ...cat, id: `roof-${String(now)}`, x: 1180, y: 60, patrolMin: 1120, patrolMax: 1240, expiresAt: now + 8 * 60 * 60 * 1000 };
}

/** Mirrors the sim's legendary cadence so the canvas agrees with the canon. */
export function isLegendaryDay(day: number): boolean {
  return day % 11 === 7;
}

/** Three pokes of the kettle inside thirty seconds summons the cat. */
export function kettlePokesSummonCat(pokeTimes: number[], now: number): boolean {
  const recent = pokeTimes.filter((t) => now - t <= KETTLE_POKE_WINDOW_MS);
  return recent.length >= KETTLE_POKES_REQUIRED;
}

/** Advance an entity by dtMs: patrol and face the direction of travel. */
export function stepEntity(e: Entity, dtMs: number): Entity {
  if (e.dx === 0) return e;
  let x = e.x + (e.dx * dtMs) / 1000;
  let dx = e.dx;
  if (x > e.patrolMax) {
    x = e.patrolMax;
    dx = -Math.abs(e.dx);
  }
  if (x < e.patrolMin) {
    x = e.patrolMin;
    dx = Math.abs(e.dx);
  }
  return { ...e, x, dx };
}

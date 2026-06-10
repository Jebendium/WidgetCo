// Theatre batch: assign every event a scheduled reveal timestamp spread across
// the UK working day (09:00–17:30 inclusive), and generate poke lines.
//
// HARD ACCEPTANCE CRITERION (build-spec §4 / kickoff): every event ts must fall
// within [09:00, 17:30] UK on the sim date. In dry-run the spread is
// deterministic. We use a fixed +01:00 offset for British Summer Time (the sim
// runs on UK working hours; June is BST).

import type { PokeLine, SimEvent } from './types.js';

// The office day, in minutes past midnight UK local time.
const DAY_START_MIN = 9 * 60; // 09:00
const DAY_END_MIN = 17 * 60 + 30; // 17:30

/**
 * Determine the UK local UTC offset for a given ISO date. The UK is on BST
 * (+01:00) from late March to late October, otherwise GMT (+00:00). For Phase 1
 * a month-based approximation is sufficient and keeps the timestamps readable.
 */
function ukOffset(dateISO: string): string {
  const month = Number(dateISO.slice(5, 7));
  // Approx: BST for Apr–Oct inclusive, GMT otherwise. (Edge weeks of Mar/Oct are
  // not significant for the sim and would never push a 09:00–17:30 slot out of
  // its window.)
  const bst = month >= 4 && month <= 10;
  return bst ? '+01:00' : '+00:00';
}

/** Build an ISO timestamp with UK offset for the given date and minute-of-day. */
function tsForMinute(dateISO: string, minuteOfDay: number): string {
  const clamped = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, minuteOfDay));
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  const hhStr = String(hh).padStart(2, '0');
  const mmStr = String(mm).padStart(2, '0');
  return `${dateISO}T${hhStr}:${mmStr}:00${ukOffset(dateISO)}`;
}

/**
 * Assign deterministic timestamps to every event WITHOUT one, spread evenly
 * across the given window (defaults to the whole 09:00–17:30 day) in event
 * order. Events that already carry a ts — e.g. the morning session's, when
 * the afternoon session runs — are left untouched. Mutates in place.
 */
export function assignTimestamps(
  events: SimEvent[],
  dateISO: string,
  startMin = DAY_START_MIN,
  endMin = DAY_END_MIN,
): void {
  const fresh = events.filter((ev) => !ev.ts);
  const n = fresh.length;
  if (n === 0) return;
  const span = endMin - startMin;

  fresh.forEach((ev, i) => {
    const frac = n === 1 ? 0 : i / (n - 1);
    const minute = Math.round(startMin + span * frac);
    ev.ts = tsForMinute(dateISO, minute);
  });
}

/** Session timestamp windows, minutes past midnight UK. */
export const SESSION_WINDOWS = {
  full: { start: DAY_START_MIN, end: DAY_END_MIN },
  morning: { start: DAY_START_MIN, end: 12 * 60 + 45 },
  afternoon: { start: 13 * 60, end: DAY_END_MIN },
} as const;

export type Session = keyof typeof SESSION_WINDOWS;

/** True if every event has a ts within [09:00, 17:30] UK on dateISO. */
export function allTimestampsInWindow(events: SimEvent[], dateISO: string): boolean {
  return events.every((ev) => {
    if (!ev.ts) return false;
    // Parse the local HH:MM from the ISO string (offset matches the date).
    const m = /T(\d{2}):(\d{2})/.exec(ev.ts);
    if (!m) return false;
    const minute = Number(m[1]) * 60 + Number(m[2]);
    const sameDate = ev.ts.startsWith(dateISO);
    return sameDate && minute >= DAY_START_MIN && minute <= DAY_END_MIN;
  });
}

/** Generate ~`count` placeholder poke lines per agent (in dry-run). */
export function generatePokeLines(agentIds: string[], count = 20): PokeLine[] {
  const lines: PokeLine[] = [];
  for (const agentId of agentIds) {
    for (let i = 1; i <= count; i++) {
      lines.push({
        agentId,
        line: `[poke ${i}] ${agentId} acknowledges the disturbance and continues working. (Placeholder; live runs are in voice.)`,
      });
    }
  }
  return lines;
}

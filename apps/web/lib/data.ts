// Data provider. Phase 2 (local): reads the sim's out/day-NNN.json files.
// The same interface will be backed by Supabase before deployment — pages and
// API routes depend only on these functions.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SimDayFile } from './types';

/** Resolve the sim output directory: env override, else ../../out. */
function outDir(): string {
  return process.env.WIDGETCO_OUT_DIR ?? resolve(process.cwd(), '..', '..', 'out');
}

const DAY_FILE = /^day-(\d{3})\.json$/;

/** Days for which sim output exists, ascending. Empty if the dir is missing. */
export function listDays(): number[] {
  let names: string[];
  try {
    names = readdirSync(outDir());
  } catch {
    return [];
  }
  return names
    .map((n) => DAY_FILE.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

export function latestDay(): number | null {
  const days = listDays();
  return days.length > 0 ? (days[days.length - 1] ?? null) : null;
}

/** Load one simulated day, or null if absent/unreadable. */
export function readDay(day: number): SimDayFile | null {
  const path = join(outDir(), `day-${String(day).padStart(3, '0')}.json`);
  try {
    const text = readFileSync(path, 'utf8');
    return JSON.parse(text) as SimDayFile;
  } catch {
    return null;
  }
}

/** The running-cost line for the site footer (part of the exhibition). */
export function runningCostLine(): string {
  const latest = latestDay();
  const file = latest === null ? null : readDay(latest);
  const gbpPerDay = file?.projection?.gbpPerDay;
  if (gbpPerDay === undefined) {
    return 'This company is run for approximately nothing per day.';
  }
  return `This company is run for £${gbpPerDay.toFixed(4)} per day.`;
}

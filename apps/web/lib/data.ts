// Data provider. Production: Supabase (days.payload holds the verbatim day
// file the gating logic is tested against). Local dev without env: the sim's
// out/day-NNN.json files. Same shapes either way.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { supabase } from './db';
import type { SimDayFile } from './types';

// --- File fallback -----------------------------------------------------------

function outDir(): string {
  return process.env.WIDGETCO_OUT_DIR ?? resolve(process.cwd(), '..', '..', 'out');
}

const DAY_FILE = /^day-(\d{3})\.json$/;

function listDaysFromFiles(): number[] {
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

function readDayFromFile(day: number): SimDayFile | null {
  const path = join(outDir(), `day-${String(day).padStart(3, '0')}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SimDayFile;
  } catch {
    return null;
  }
}

// --- Provider ------------------------------------------------------------------

/** Days for which sim output exists, ascending. */
export async function getDays(): Promise<number[]> {
  const db = supabase();
  if (!db) return listDaysFromFiles();
  const { data, error } = await db.from('days').select('day').order('day');
  if (error) return [];
  return (data as { day: number }[]).map((r) => r.day);
}

export async function getLatestDay(): Promise<number | null> {
  const days = await getDays();
  return days.length > 0 ? (days[days.length - 1] ?? null) : null;
}

/** Load one simulated day, or null if absent. */
export async function getDay(day: number): Promise<SimDayFile | null> {
  const db = supabase();
  if (!db) return readDayFromFile(day);
  const { data, error } = await db.from('days').select('payload').eq('day', day).maybeSingle();
  if (error || !data?.payload) return null;
  return data.payload as SimDayFile;
}

/** The running-cost line for the site footer (part of the exhibition). */
export async function runningCostLine(): Promise<string> {
  const latest = await getLatestDay();
  const file = latest === null ? null : await getDay(latest);
  const gbpPerDay = file?.projection?.gbpPerDay;
  if (gbpPerDay === undefined) {
    return 'This company is run for approximately nothing per day.';
  }
  return `This company is run for £${gbpPerDay.toFixed(4)} per day.`;
}

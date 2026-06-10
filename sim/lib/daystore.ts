// Read back previous days' output — from Supabase (the crons; out/ is not
// committed) or local files (dev). The audit tick reviews ALL of it.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface StoredEmail {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export interface StoredEntry {
  id: string;
  date: string;
  memo: string;
  agent?: string;
  lines: { account: string; debit: number; credit: number }[];
}

export interface StoredDay {
  day: number;
  date: string;
  emails: StoredEmail[];
  ledgerEntries: StoredEntry[];
  trialBalance: {
    rows: { code: string; name: string; type: string; debit: number; credit: number; balance: number }[];
    totalDebits: number;
    totalCredits: number;
    balances: boolean;
  };
}

function fromFiles(outDir: string): StoredDay[] {
  let names: string[] = [];
  try {
    names = readdirSync(outDir);
  } catch {
    return [];
  }
  return names
    .filter((n) => /^day-\d{3}\.json$/.test(n))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(outDir, n), 'utf8')) as StoredDay);
}

/** The highest stored day number, or 0 when none exist. */
export async function maxStoredDay(db: SupabaseClient | null, outDir: string): Promise<number> {
  if (db) {
    try {
      const { data, error } = await db
        .from('days')
        .select('day')
        .order('day', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error) {
        const row: { day: number } | null = data;
        return row ? row.day : 0;
      }
    } catch {
      // fall through to files
    }
  }
  const days = fromFiles(outDir);
  return days[days.length - 1]?.day ?? 0;
}

/** All stored days, ascending. */
export async function loadAllDays(
  db: SupabaseClient | null,
  outDir: string,
): Promise<StoredDay[]> {
  if (db) {
    try {
      const { data, error } = await db.from('days').select('payload').order('day');
      if (!error) {
        const rows = data as { payload: StoredDay }[];
        if (rows.length > 0) return rows.map((r) => r.payload);
      }
    } catch {
      // fall through to files
    }
  }
  return fromFiles(outDir);
}

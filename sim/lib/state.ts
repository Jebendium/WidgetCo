// Persistent simulation state between runs. Supabase row when env is
// present (the crons), out/sim-state.json otherwise (local dev). Both are
// written when both are available, so local runs and CI converge.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FraudState } from './fraud.js';

export interface PendingEmail {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export interface PendingAudit {
  /** One-line summary injected into the next tick's inputs. */
  summary: string;
  emails: PendingEmail[];
}

export interface PendingLetter {
  ref: string;
  subject: string;
  body: string;
}

export interface SimState {
  /** The last COMPLETED simulated day. */
  day: number;
  fraud: { state: FraudState; arcDay: number; daysInState: number };
  /** Cumulative recognised revenue, integer pence, since the arc began. */
  cumulativeRevenuePence: number;
  /** Internal Audit's persistent suspicion score (0..1+). */
  auditSuspicion: number;
  /** Rolling one-line-per-day digest, most recent last (max 14). */
  historyDigest: string[];
  pendingAudit: PendingAudit | null;
  pendingRegulator: PendingLetter | null;
}

export function initialState(): SimState {
  return {
    day: 0,
    fraud: { state: 'CLEAN', arcDay: 0, daysInState: 0 },
    cumulativeRevenuePence: 0,
    auditSuspicion: 0,
    historyDigest: [],
    pendingAudit: null,
    pendingRegulator: null,
  };
}

/** Merge a parsed candidate over defaults, defensively. */
function coerce(candidate: unknown): SimState {
  const base = initialState();
  if (typeof candidate !== 'object' || candidate === null) return base;
  return { ...base, ...(candidate as Partial<SimState>) };
}

export async function loadSimState(
  db: SupabaseClient | null,
  filePath: string,
): Promise<SimState> {
  if (db) {
    try {
      const { data, error } = await db.from('sim_state').select('data').eq('id', 1).maybeSingle();
      if (!error && data?.data) return coerce(data.data);
    } catch {
      // fall through to the file
    }
  }
  if (existsSync(filePath)) {
    try {
      return coerce(JSON.parse(readFileSync(filePath, 'utf8')));
    } catch {
      // corrupted local state: start clean rather than crash the cron
    }
  }
  return initialState();
}

export async function saveSimState(
  db: SupabaseClient | null,
  filePath: string,
  state: SimState,
): Promise<void> {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // local write is best-effort when the DB is the source of truth
  }
  if (db) {
    await db.from('sim_state').upsert({ id: 1, data: state, updated_at: new Date().toISOString() });
  }
}

/** Append a day line to the digest, keeping the most recent 14. */
export function appendDigest(state: SimState, line: string): void {
  state.historyDigest = [...state.historyDigest.slice(-13), line];
}

// The poltergeist's paper trail: the web tier aggregates visitor pokes into
// out/disturbances.json; the next daily tick CONSUMES them (read then reset)
// and presents them to the agents as an unexplained workplace phenomenon, to
// be handled through proper channels. Spec §8.5: the disturbance feeds the
// next tick, which honours it canonically.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAgent } from './agents.js';

export interface DisturbanceCounts {
  [agentId: string]: number;
}

interface DisturbanceFile {
  pending?: Record<string, unknown>;
  updatedAt?: string;
}

/** Read pending disturbance counts and reset the file (consume-on-read). */
export function consumeDisturbances(path: string): DisturbanceCounts {
  if (!existsSync(path)) return {};

  let parsed: DisturbanceFile;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as DisturbanceFile;
  } catch {
    return {};
  }

  const counts: DisturbanceCounts = {};
  for (const [agentId, value] of Object.entries(parsed.pending ?? {})) {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) counts[agentId] = n;
  }

  try {
    writeFileSync(
      path,
      JSON.stringify({ pending: {}, updatedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
  } catch {
    // If the reset fails the counts will be double-reported tomorrow, which
    // the Company would file under "the phenomenon is escalating".
  }
  return counts;
}

interface DisturbanceRow {
  id: number;
  agent_id: string;
  count: number;
}

/** Consume unconsumed disturbance rows from the database. */
async function consumeSupabaseDisturbances(db: SupabaseClient): Promise<DisturbanceCounts> {
  const counts: DisturbanceCounts = {};
  try {
    const { data, error } = await db
      .from('disturbances')
      .select('id, agent_id, count')
      .eq('consumed', false)
      .limit(5000);
    if (error) return counts;

    const rows = data as DisturbanceRow[];
    if (rows.length === 0) return counts;
    for (const row of rows) {
      counts[row.agent_id] = (counts[row.agent_id] ?? 0) + row.count;
    }
    await db.from('disturbances').update({ consumed: true }).in('id', rows.map((r) => r.id));
  } catch {
    // The phenomenon resists measurement today; tomorrow's tick will catch up.
  }
  return counts;
}

/** Consume from every source — database and local file — and merge. */
export async function consumeAllDisturbances(
  db: SupabaseClient | null,
  filePath: string,
): Promise<DisturbanceCounts> {
  const fromFile = consumeDisturbances(filePath);
  const fromDb = db ? await consumeSupabaseDisturbances(db) : {};
  const merged: DisturbanceCounts = { ...fromFile };
  for (const [agentId, n] of Object.entries(fromDb)) {
    merged[agentId] = (merged[agentId] ?? 0) + n;
  }
  return merged;
}

/** Render counts as the in-world disturbance report for today's inputs. */
export function disturbanceReport(counts: DisturbanceCounts): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return 'Disturbances: none reported since the last business day. An unusually still office; some staff find this worse.';
  }
  const parts = entries
    .sort(([, a], [, b]) => b - a)
    .map(([agentId, n]) => {
      let name = agentId;
      try {
        name = getAgent(agentId).name;
      } catch {
        // Unknown ids are reported as found; the phenomenon is not tidy.
      }
      return `${name} was disturbed ${n} time${n === 1 ? '' : 's'}`;
    });
  return `Disturbances since the last business day (unexplained interactions, under observation): ${parts.join('; ')}.`;
}

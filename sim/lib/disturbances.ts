// The poltergeist's paper trail: the web tier aggregates visitor pokes into
// out/disturbances.json; the next daily tick CONSUMES them (read then reset)
// and presents them to the agents as an unexplained workplace phenomenon, to
// be handled through proper channels. Spec §8.5: the disturbance feeds the
// next tick, which honours it canonically.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

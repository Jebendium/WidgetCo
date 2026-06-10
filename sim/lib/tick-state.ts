// Glue between the persistent SimState and a running tick: fraud metrics from
// the ledger + state, overnight deliveries into the world, and end-of-tick
// persistence. Split from tick-daily.ts to keep both within the size budget.

import type { SupabaseClient } from '@supabase/supabase-js';
import { revenueShortfallPct, type FraudEngine, type FraudMetrics } from './fraud.js';
import { disturbanceReport } from './disturbances.js';
import { appendDigest, saveSimState, type SimState } from './state.js';
import { nextEmailId, nextEventId, type WorldState } from './world.js';

/**
 * Deterministic sim date: day 1 anchors to Tuesday 2026-06-09 and each
 * subsequent day is the next WEEKDAY — the company does not trade weekends
 * (invariant #7), so sim dates must never land on one.
 */
export function simDateFor(day: number): string {
  const d = new Date(Date.UTC(2026, 5, 9));
  let remaining = Math.max(0, Math.trunc(day) - 1);
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d.toISOString().slice(0, 10);
}

/** Recognised income posted today, integer pence (trial balance income side). */
export function todaysRevenue(world: WorldState): number {
  return world.ledger
    .trialBalance()
    .rows.filter((r) => r.type === 'income')
    .reduce((sum, r) => sum + Math.abs(r.balance), 0);
}

export function computeFraudMetrics(world: WorldState, state: SimState, day: number): FraudMetrics {
  const tb = world.ledger.trialBalance();
  let receivables = 0;
  let revenue = 0;
  for (const row of tb.rows) {
    if (row.type === 'income') revenue += Math.abs(row.balance);
    if (row.type === 'asset' && /debtor|receivable/i.test(row.name)) {
      receivables += Math.abs(row.balance);
    }
  }
  const receivablesToRevenueRatio = revenue > 0 ? receivables / revenue : 0;
  return {
    receivablesToRevenueRatio,
    revenueShortfallPct: revenueShortfallPct(state.cumulativeRevenuePence + revenue, day),
    // The weekly audit run owns this score; the daily tick only reads it.
    auditSuspicion: state.auditSuspicion,
  };
}

/**
 * Deliver overnight arrivals — Internal Audit's Sunday correspondence and
 * any regulatory letter — into today's world, so they appear in the feed and
 * colleagues can react. Returns in-world notes for today's inputs.
 */
export function deliverOvernight(world: WorldState, state: SimState): string[] {
  const notes: string[] = [];

  if (state.pendingAudit) {
    for (const mail of state.pendingAudit.emails) {
      const ev = {
        id: nextEventId(world),
        day: world.day,
        ts: '',
        agentId: 'audit',
        kind: 'email' as const,
        payload: {},
        public: true,
      };
      world.events.push(ev);
      const email = {
        id: nextEmailId(world),
        eventId: ev.id,
        from: 'audit',
        to: mail.to,
        cc: mail.cc,
        subject: mail.subject,
        body: mail.body,
      };
      world.emails.push(email);
      ev.payload = { emailId: email.id, subject: email.subject, to: email.to };
    }
    notes.push(state.pendingAudit.summary);
  }

  if (state.pendingRegulator) {
    const letter = state.pendingRegulator;
    world.events.push({
      id: nextEventId(world),
      day: world.day,
      ts: '',
      agentId: 'regulator',
      kind: 'memo',
      payload: { ref: letter.ref, subject: letter.subject, body: letter.body },
      public: true,
    });
    notes.push(
      `A letter has arrived from the Financial Conduct Authority of Greater Dudley (${letter.ref}): "${letter.subject}". Full text:\n${letter.body}`,
    );
  }

  return notes;
}

/**
 * The Disturbance Report: yesterday's poltergeist activity, published to the
 * audience as the company formally processing them (they love this).
 */
export function publishDisturbanceReport(
  world: WorldState,
  day: number,
  disturbances: Record<string, number>,
): void {
  if (Object.keys(disturbances).length === 0) return;
  world.events.push({
    id: nextEventId(world),
    day,
    ts: '',
    agentId: 'middle-manager',
    kind: 'memo',
    payload: {
      subject: 'Disturbance Report — circulated for awareness',
      body: `${disturbanceReport(disturbances)} The phenomenon remains under observation through the established channels.`,
    },
    public: true,
  });
}

/** End-of-tick persistence. Dry runs never advance state — they are tests. */
export async function persistTickState(args: {
  db: SupabaseClient | null;
  statePath: string;
  state: SimState;
  world: WorldState;
  fraud: FraudEngine;
  day: number;
  date: string;
  dryRun: boolean;
}): Promise<void> {
  const { state, world, fraud, day, date } = args;
  if (args.dryRun) return;

  state.day = day;
  state.fraud = fraud.snapshot();
  state.cumulativeRevenuePence += todaysRevenue(world);
  appendDigest(
    state,
    `Day ${day} (${date}): ${world.emails.length} emails, ${world.ledger.entries.length} entries; ` +
      `subjects: ${world.emails.slice(0, 3).map((e) => e.subject).join(' | ')}`,
  );
  state.pendingAudit = null;
  state.pendingRegulator = null;
  await saveSimState(args.db, args.statePath, state);
}

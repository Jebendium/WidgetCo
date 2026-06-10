// Public projection of the ledger. Strips `suspicious` (hard invariant) and
// withholds entries/rejections whose announcing event has not yet revealed.
// Entries with no announcing event (e.g. the opening balance, posted by the
// engine before the day starts) are visible immediately.

import { gateEvents } from './feed';
import type { JournalLine, Rejection, SimDayFile } from './types';

export interface PublicLedgerEntry {
  id: string;
  memo: string;
  date: string;
  agent?: string;
  lines: JournalLine[];
}

export interface PublicLedgerDay {
  day: number;
  date: string;
  entries: PublicLedgerEntry[];
  rejections: Rejection[];
}

function refValue(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === 'string' ? v : null;
}

/** Ids referenced by ANY ledger event vs ids whose event has been revealed. */
function ledgerVisibility(
  file: SimDayFile,
  now: Date,
  key: 'entryId' | 'rejectionId',
): { referenced: Set<string>; revealed: Set<string> } {
  const referenced = new Set<string>();
  const revealed = new Set<string>();

  for (const ev of file.events) {
    if (ev.kind !== 'ledger') continue;
    const id = refValue(ev.payload, key);
    if (id) referenced.add(id);
  }
  const gated = gateEvents(
    file.events.filter((e) => e.kind === 'ledger'),
    now,
  );
  for (const ev of gated.events) {
    const id = refValue(ev.payload, key);
    if (id) revealed.add(id);
  }
  return { referenced, revealed };
}

/** The publicly visible ledger for one day at the given moment. */
export function visibleLedger(file: SimDayFile, now: Date): PublicLedgerDay {
  const entryVis = ledgerVisibility(file, now, 'entryId');
  const rejectionVis = ledgerVisibility(file, now, 'rejectionId');

  const entries: PublicLedgerEntry[] = file.ledgerEntries
    .filter((e) => !entryVis.referenced.has(e.id) || entryVis.revealed.has(e.id))
    .map((e) => ({
      id: e.id,
      memo: e.memo,
      date: e.date,
      ...(e.agent !== undefined ? { agent: e.agent } : {}),
      lines: e.lines.map((l) => ({ ...l })),
    }));

  const rejections = file.rejections.filter(
    (r) => !rejectionVis.referenced.has(r.id) || rejectionVis.revealed.has(r.id),
  );

  return { day: file.day, date: file.date, entries, rejections };
}

/** Format integer pence as £x,xxx.xx (UK English, £, always). */
export function gbp(pence: number): string {
  const negative = pence < 0;
  const abs = Math.abs(pence);
  const pounds = Math.floor(abs / 100).toLocaleString('en-GB');
  const pp = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}£${pounds}.${pp}`;
}

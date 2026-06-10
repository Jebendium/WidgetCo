// Shared mutable world state for one daily tick, plus the seed/opening balance
// and chart-of-accounts parsing.

import { readFileSync, existsSync } from 'node:fs';
import { Ledger, simpleEntry } from './ledger.js';
import { poundsToPence } from './types.js';
import type {
  Account,
  AccountType,
  Email,
  JournalLine,
  Money,
  PokeLine,
  ShareAnchor,
  SimEvent,
} from './types.js';

export interface WorldState {
  ledger: Ledger;
  emails: Email[];
  events: SimEvent[];
  expenses: SimEvent[];
  announcements: SimEvent[];
  meetings: SimEvent[];
  /** Staged memory text per agent, written at the end of the tick. */
  memories: Record<string, string>;
  shareAnchors: ShareAnchor[];
  pokePool: PokeLine[];
  day: number;
  date: string; // ISO date for the sim day
  // Internal sequence counters for stable ids.
  _eventSeq: number;
  _emailSeq: number;
}

export function createWorld(day: number, date: string): WorldState {
  return {
    ledger: new Ledger(),
    emails: [],
    events: [],
    expenses: [],
    announcements: [],
    meetings: [],
    memories: {},
    shareAnchors: [],
    pokePool: [],
    day,
    date,
    _eventSeq: 0,
    _emailSeq: 0,
  };
}

export function nextEventId(world: WorldState): string {
  world._eventSeq += 1;
  return `EV-${String(world._eventSeq).padStart(4, '0')}`;
}

export function nextEmailId(world: WorldState): string {
  world._emailSeq += 1;
  return `EM-${String(world._emailSeq).padStart(4, '0')}`;
}

// --- Fallback chart of accounts --------------------------------------------
// Used only if sim/canon/chart-of-accounts.md is absent at runtime. A small,
// sensible UK SME chart. The canonical chart is owned by the other worker.

export const FALLBACK_CHART: Account[] = [
  { code: '0050', name: 'Plant and machinery', type: 'asset' },
  { code: '1001', name: 'Stock', type: 'asset' },
  { code: '1100', name: 'Trade debtors', type: 'asset' },
  { code: '1200', name: 'Bank current account', type: 'asset' },
  { code: '2100', name: 'Trade creditors', type: 'liability' },
  { code: '2200', name: 'VAT liability', type: 'liability' },
  { code: '2300', name: 'Bank loan', type: 'liability' },
  { code: '3000', name: 'Share capital', type: 'equity' },
  { code: '3200', name: 'Retained earnings', type: 'equity' },
  { code: '4000', name: 'Widget sales', type: 'income' },
  { code: '5000', name: 'Cost of widgets sold', type: 'expense' },
  { code: '7000', name: 'Wages and salaries', type: 'expense' },
  { code: '7500', name: 'Office and administration', type: 'expense' },
];

const VALID_TYPES: AccountType[] = [
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
];

/** Find an account type mentioned anywhere in the given cells. */
function findAccountType(cells: string[]): AccountType | undefined {
  for (const cell of cells) {
    const low = cell.toLowerCase();
    const match = VALID_TYPES.find((t) => low.includes(t));
    if (match) return match;
  }
  return undefined;
}

/** Parse one markdown table row into an Account, or null if it is not one. */
function parseChartRow(rawLine: string): Account | null {
  const line = rawLine.trim();
  if (!line.startsWith('|')) return null;
  // Split a markdown table row into cells.
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.length < 3) return null;
  // Skip header and separator rows.
  if (cells.every((c) => /^[-:\s]*$/.test(c))) return null;

  const code = cells[0] ?? '';
  if (!/^\d{3,5}$/.test(code)) return null; // first cell must look like a code

  const name = cells[1] ?? '';
  const type = findAccountType(cells.slice(2));
  return type ? { code, name, type } : null;
}

/**
 * Parse account codes from a simple markdown table in chart-of-accounts.md.
 * Expected columns include a code, a name and a type. Robust to extra columns
 * and varied headings; falls back to FALLBACK_CHART if nothing usable is found.
 */
export function loadChartFromCanon(path: string): Account[] {
  if (!existsSync(path)) return FALLBACK_CHART;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return FALLBACK_CHART;
  }

  const accounts: Account[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const account = parseChartRow(rawLine);
    if (account) accounts.push(account);
  }

  return accounts.length >= 4 ? accounts : FALLBACK_CHART;
}

/** Parse a money cell like "1,200,000" or "£95,000.50" into pence, or null. */
function parseMoneyCell(cell: string): Money | null {
  const cleaned = cell.replace(/[£,\s*]/g, '');
  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return poundsToPence(Number(cleaned));
}

/** Build a one-sided JournalLine when exactly one money cell is present. */
function toJournalLine(
  code: string,
  debit: Money | null,
  credit: Money | null,
): JournalLine | null {
  // Exactly one side must carry an amount (the ledger enforces this too).
  if (debit !== null && credit === null) return { account: code, debit, credit: 0 };
  if (credit !== null && debit === null) return { account: code, debit: 0, credit };
  return null;
}

/** Parse one opening-trial-balance table row into a JournalLine, or null. */
function parseOpeningRow(rawLine: string): JournalLine | null {
  const line = rawLine.trim();
  if (!line.startsWith('|')) return null;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.length < 4) return null;

  const code = cells[0] ?? '';
  if (!/^\d{3,5}$/.test(code)) return null;

  return toJournalLine(code, parseMoneyCell(cells[2] ?? ''), parseMoneyCell(cells[3] ?? ''));
}

/**
 * Parse the illustrative opening trial balance table from chart-of-accounts.md
 * (rows with a code plus a Debit or Credit money cell). Returns [] if the file
 * is missing or contains no such table — callers fall back to the seeded chart.
 */
export function loadOpeningBalancesFromCanon(path: string): JournalLine[] {
  if (!existsSync(path)) return [];
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return [];
  }

  const lines: JournalLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = parseOpeningRow(rawLine);
    if (line) lines.push(line);
  }
  return lines;
}

/** Post the canon opening trial balance if it is present, valid and balanced. */
function postCanonOpening(world: WorldState, openingLines: JournalLine[]): boolean {
  if (openingLines.length === 0) return false;
  const res = world.ledger.post({
    memo: 'Opening balances as at start of trading day',
    date: world.date,
    lines: openingLines,
    agent: 'cfo',
  });
  return res.ok;
}

/**
 * Post a sensible, BALANCING opening trial balance. Prefers the illustrative
 * opening trial balance from the canon chart-of-accounts file when provided;
 * otherwise uses the expected fallback-chart codes; otherwise a minimal
 * balanced entry. The ledger's own validation gates every path.
 */
export function seedOpeningBalances(world: WorldState, canonOpening?: JournalLine[]): void {
  if (canonOpening && postCanonOpening(world, canonOpening)) return;
  if (postFallbackChartOpening(world)) return;

  // Robust fallback: a single balanced opening entry that always posts.
  // Bank (asset) debit vs Share capital (equity) credit.
  const l = world.ledger;
  const bank = l.getAccount('1200') ? '1200' : firstOfType(l, 'asset');
  const equity = l.getAccount('3000') ? '3000' : firstOfType(l, 'equity');
  if (bank && equity) {
    l.post(simpleEntry('Opening capital', world.date, bank, equity, 100_000_00, 'cfo'));
  }
}

/**
 * Post a textbook opening trial balance using the FALLBACK_CHART codes.
 * Assets = Liabilities + Equity, amounts in pence:
 * Plant £120,000 + Stock £85,000 + Debtors £64,000 + Bank £41,000 = £310,000
 * = Creditors £52,000 + Bank loan £60,000 + VAT £8,000 (Liabilities £120,000)
 * + Share capital £100,000 + Retained earnings £90,000 (Equity £190,000).
 */
function postFallbackChartOpening(world: WorldState): boolean {
  const l = world.ledger;
  const lines = [
    { code: '0050', amount: 120_000_00, side: 'debit' as const }, // Plant
    { code: '1001', amount: 85_000_00, side: 'debit' as const }, // Stock
    { code: '1100', amount: 64_000_00, side: 'debit' as const }, // Debtors
    { code: '1200', amount: 41_000_00, side: 'debit' as const }, // Bank
    { code: '2100', amount: 52_000_00, side: 'credit' as const }, // Creditors
    { code: '2300', amount: 60_000_00, side: 'credit' as const }, // Bank loan
    { code: '2200', amount: 8_000_00, side: 'credit' as const }, // VAT
    { code: '3000', amount: 100_000_00, side: 'credit' as const }, // Share capital
    { code: '3200', amount: 90_000_00, side: 'credit' as const }, // Retained earnings
  ];

  // Only attempt when every expected code exists in the loaded chart.
  if (!lines.every((entry) => l.getAccount(entry.code) !== undefined)) return false;

  const journalLines = lines.map((entry) =>
    entry.side === 'debit'
      ? { account: entry.code, debit: entry.amount, credit: 0 }
      : { account: entry.code, debit: 0, credit: entry.amount },
  );
  const res = l.post({
    memo: 'Opening balances as at start of trading day',
    date: world.date,
    lines: journalLines,
    agent: 'cfo',
  });
  return res.ok;
}

function firstOfType(l: Ledger, type: AccountType): string | undefined {
  // The Ledger does not expose the chart directly; probe the fallback codes.
  for (const a of FALLBACK_CHART) {
    if (a.type === type && l.getAccount(a.code)) return a.code;
  }
  return undefined;
}

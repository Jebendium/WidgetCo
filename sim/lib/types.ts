// Shared simulation types for Amalgamated Widget Holdings plc (Phase 1).
//
// MONEY IS INTEGER PENCE everywhere in the ledger. Using integers means
// debits === credits comparisons are exact (no floating-point drift), which is
// what lets us enforce the "ledger always balances" invariant in code.

/** Money is always an integer number of pence. Never a float, never pounds. */
export type Money = number;

/** A JSON-serialisable value (event payloads, tool arguments). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A JSON-serialisable object — the shape of every event payload. */
export type JsonObject = { [key: string]: JsonValue };

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface Account {
  code: string;
  name: string;
  type: AccountType;
}

/**
 * One side of a double-entry posting. Each line has EXACTLY ONE of debit/credit
 * greater than zero; the other side is 0. Amounts are integer pence and never
 * negative.
 */
export interface JournalLine {
  account: string;
  debit: Money;
  credit: Money;
}

export interface JournalEntryInput {
  memo: string;
  /** ISO date (YYYY-MM-DD) the entry is dated to. */
  date: string;
  lines: JournalLine[];
  /** Which agent proposed the entry, if any. */
  agent?: string;
}

export interface PostedEntry extends JournalEntryInput {
  id: string; // e.g. 'JE-0001'
  postedAt: string; // ISO timestamp
  /**
   * Set by the fraud engine, NEVER serialised into public payloads. Visitors
   * must never see this flag (feed API strips it).
   */
  suspicious: boolean;
}

export interface Rejection {
  id: string; // e.g. 'REJ-0001'
  attempted: JournalEntryInput;
  reason: string;
  at: string; // ISO timestamp
}

export type SimEventKind =
  | 'email'
  | 'ledger'
  | 'announcement'
  | 'meeting'
  | 'expense'
  | 'memo'
  | 'web_search';

export interface SimEvent {
  id: string;
  day: number;
  /** ISO timestamp WITH UK local time — the scheduled reveal time. */
  ts: string;
  agentId: string;
  kind: SimEventKind;
  payload: JsonObject;
  public: boolean;
  /** Internal only — must never be serialised to public feed payloads. */
  suspicious?: boolean;
  /** Marks a walk/action the visitor can interrupt by poking (build-spec §8.5). */
  interruptible?: boolean;
}

export interface Email {
  id: string;
  eventId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

/** Market-maker output: a share price anchor the client interpolates between. */
export interface ShareAnchor {
  ts: string;
  price: number; // pence per share
  cause: string;
}

/** A single in-voice poke line for an agent (build-spec §8.5). */
export interface PokeLine {
  agentId: string;
  line: string;
}

// --- Money helpers -------------------------------------------------------

/** Convert pounds (possibly fractional) to integer pence, rounded to nearest. */
export function poundsToPence(pounds: number): Money {
  return Math.round(pounds * 100);
}

/** Convert integer pence to a pounds number. */
export function penceToPounds(pence: Money): number {
  return pence / 100;
}

/** Format integer pence as a UK currency string, e.g. £1,234.56. */
export function formatGBP(pence: Money): string {
  const negative = pence < 0;
  const abs = Math.abs(pence);
  const pounds = Math.floor(abs / 100);
  const remainder = (abs % 100).toString().padStart(2, '0');
  const grouped = pounds.toLocaleString('en-GB');
  return `${negative ? '-' : ''}£${grouped}.${remainder}`;
}

// Types for the sim's day-file output (the Phase 2 data source) and the
// PUBLIC payload shapes served to visitors. The public shapes deliberately
// omit `suspicious` (hard invariant: never serialised to public payloads)
// and `fraudState` (engine state; spoilers).

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type SimEventKind =
  | 'email'
  | 'ledger'
  | 'announcement'
  | 'meeting'
  | 'expense'
  | 'memo'
  | 'web_search';

/** An event exactly as the sim wrote it — INTERNAL, never serialised as-is. */
export interface RawSimEvent {
  id: string;
  day: number;
  ts: string;
  agentId: string;
  kind: SimEventKind;
  payload: JsonObject;
  public: boolean;
  suspicious?: boolean;
  interruptible?: boolean;
}

export interface SimEmail {
  id: string;
  eventId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}

export interface RawLedgerEntry {
  id: string;
  memo: string;
  date: string;
  lines: JournalLine[];
  agent?: string;
  postedAt: string;
  suspicious: boolean;
}

export interface Rejection {
  id: string;
  attempted: { memo: string; date: string; lines: JournalLine[]; agent?: string };
  reason: string;
  at: string;
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  balances: boolean;
}

export interface ShareAnchor {
  ts: string;
  price: number;
  cause: string;
}

export interface PokeLine {
  agentId: string;
  line: string;
}

export interface DialogueFollowup {
  q: string;
  a: string;
}

export interface DialogueTopic {
  q: string;
  a: string;
  followups: DialogueFollowup[];
}

export interface AgentDialogue {
  opener: string;
  topics: DialogueTopic[];
}

export type Dialogues = Record<string, AgentDialogue>;

/** The shape of out/day-NNN.json as written by the sim's daily tick. */
export interface SimDayFile {
  day: number;
  date: string;
  fraudState: string; // NEVER expose
  events: RawSimEvent[];
  emails: SimEmail[];
  ledgerEntries: RawLedgerEntry[];
  rejections: Rejection[];
  trialBalance: TrialBalance;
  shareAnchors: ShareAnchor[];
  pokePool: PokeLine[];
  recap: string;
  dialogues?: Dialogues;
  /** Replies to our correspondents, from the Correspondence Office. */
  correspondence?: { re: string; body: string }[];
  memories: Record<string, string>;
  projection?: { gbpPerDay?: number; gbpPerYear?: number };
}

// --- Public payloads ---------------------------------------------------------

/** A revealed event as served to visitors. No `suspicious`, no `public`. */
export interface PublicEvent {
  id: string;
  day: number;
  ts: string;
  agentId: string;
  kind: SimEventKind;
  payload: JsonObject;
  interruptible?: boolean;
}

/** A not-yet-revealed event: the schedule only, never the payload. */
export interface UpcomingStub {
  id: string;
  ts: string;
}

/** A share anchor already in the past; future anchors are withheld entirely. */
export interface PublicAnchor {
  ts: string;
  price: number;
  cause: string;
}

export interface FeedResponse {
  day: number;
  date: string;
  recap: string;
  serverNow: string;
  events: PublicEvent[];
  upcoming: UpcomingStub[];
  anchors: PublicAnchor[];
  /** The day's pre-scripted talk-to-staff dialogue trees. */
  dialogues: Dialogues;
}

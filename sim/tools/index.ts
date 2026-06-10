// Tool schemas (OpenAI format) and implementations, with per-agent allowlists.
// The permission matrix is part of the design (build-spec §5) — disallowed calls
// are rejected with an error result, not silently executed.

import type { ToolSchema } from '../lib/llm.js';
import type { JournalLine, JsonObject, SimEvent } from '../lib/types.js';
import {
  nextEmailId,
  nextEventId,
  type WorldState,
} from '../lib/world.js';

// --- Per-agent allowlist (build-spec §5) -----------------------------------

export const TOOL_ALLOWLIST: Record<string, string[]> = {
  ceo: ['send_email', 'web_search', 'file_expense', 'respond_to_shareholder', 'update_memory'],
  sales: ['send_email', 'update_memory'],
  cfo: ['post_journal_entry', 'send_email', 'respond_to_shareholder', 'update_memory'],
  comms: ['send_email', 'web_search', 'issue_announcement', 'update_memory'],
  'middle-manager': ['send_email', 'schedule_meeting', 'update_memory'],
  // Not run in the daily tick, but the matrix is defined for completeness.
  audit: ['send_email', 'web_search', 'update_memory'],
  regulator: ['send_email', 'update_memory'],
};

// --- Tool schemas ----------------------------------------------------------

const ALL_TOOLS: Record<string, ToolSchema> = {
  post_journal_entry: {
    type: 'function',
    function: {
      name: 'post_journal_entry',
      description:
        'Post a double-entry journal to the general ledger. Debits must equal credits or the entry is rejected. Amounts are integer pence.',
      parameters: {
        type: 'object',
        properties: {
          memo: { type: 'string', description: 'Narrative for the entry.' },
          date: { type: 'string', description: 'ISO date (YYYY-MM-DD).' },
          lines: {
            type: 'array',
            description: 'Journal lines. Each has exactly one of debit/credit > 0 (pence).',
            items: {
              type: 'object',
              properties: {
                account: { type: 'string', description: 'Account code.' },
                debit: { type: 'integer', description: 'Debit in pence (0 if credit line).' },
                credit: { type: 'integer', description: 'Credit in pence (0 if debit line).' },
              },
              required: ['account', 'debit', 'credit'],
            },
          },
        },
        required: ['memo', 'date', 'lines'],
      },
    },
  },
  send_email: {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an internal email to one or more colleagues, optionally CCing others.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'array', items: { type: 'string' }, description: 'Recipient agent ids.' },
          cc: { type: 'array', items: { type: 'string' }, description: 'CC agent ids.' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  web_search: {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for recent UK news headlines relevant to the business.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  issue_announcement: {
    type: 'function',
    function: {
      name: 'issue_announcement',
      description: 'Issue a public RNS-style announcement. Feeds the market maker.',
      parameters: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['headline', 'body'],
      },
    },
  },
  file_expense: {
    type: 'function',
    function: {
      name: 'file_expense',
      description: 'File a company expense claim. Finance approves automatically; receipts are public.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amountPence: { type: 'integer', description: 'Amount in pence.' },
          category: { type: 'string' },
        },
        required: ['description', 'amountPence'],
      },
    },
  },
  schedule_meeting: {
    type: 'function',
    function: {
      name: 'schedule_meeting',
      description: 'Schedule a meeting in the public calendar.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          attendees: { type: 'array', items: { type: 'string' } },
          when: { type: 'string', description: 'Free-text time, e.g. "2pm Thursday".' },
        },
        required: ['title', 'attendees'],
      },
    },
  },
  respond_to_shareholder: {
    type: 'function',
    function: {
      name: 'respond_to_shareholder',
      description: 'Respond to a queued shareholder tip or AGM question.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question being answered.' },
          response: { type: 'string' },
        },
        required: ['response'],
      },
    },
  },
  update_memory: {
    type: 'function',
    function: {
      name: 'update_memory',
      description: 'Stage updated memory text for yourself, written at end of tick.',
      parameters: {
        type: 'object',
        properties: { memory: { type: 'string' } },
        required: ['memory'],
      },
    },
  },
};

/** Return the OpenAI tool schemas the given agent is allowed to use. */
export function toolsForAgent(agentId: string): ToolSchema[] {
  const allowed = TOOL_ALLOWLIST[agentId] ?? [];
  return allowed.flatMap((name) => {
    const schema = ALL_TOOLS[name];
    return schema ? [schema] : [];
  });
}

// --- Event helpers ---------------------------------------------------------

function pushEvent(
  world: WorldState,
  agentId: string,
  kind: SimEvent['kind'],
  payload: JsonObject,
  opts: { public: boolean; suspicious?: boolean; interruptible?: boolean } = {
    public: true,
  },
): SimEvent {
  const ev: SimEvent = {
    id: nextEventId(world),
    day: world.day,
    ts: '', // assigned by the theatre batch (09:00–17:30 window)
    agentId,
    kind,
    payload,
    public: opts.public,
    suspicious: opts.suspicious,
    interruptible: opts.interruptible,
  };
  world.events.push(ev);
  return ev;
}

// Canned headlines for web_search in Phase 1 (no real web needed). Deliberately
// plain — comedy comes from the personas, not from this scaffold.
const CANNED_HEADLINES = [
  'Bank of England holds interest rates amid mixed manufacturing data.',
  'Midlands engineering output steady in latest ONS figures.',
  'Pound edges higher against the dollar in quiet trading.',
];

// --- Argument narrowing -----------------------------------------------------
// Tool arguments arrive as model-generated JSON and are therefore `unknown`.
// These helpers coerce them defensively without ever using `any`.

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Coerce a primitive to string; objects/arrays/null fall back. */
function text(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function textArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => text(x));
  const single = text(v);
  return single ? [single] : [];
}

function int(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseJournalLines(v: unknown): JournalLine[] {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const l = asRecord(raw);
    return { account: text(l.account), debit: int(l.debit), credit: int(l.credit) };
  });
}

// --- Tool handlers -----------------------------------------------------------

type ToolHandler = (
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
) => string;

function handlePostJournalEntry(
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
): string {
  const res = world.ledger.post({
    memo: text(args.memo),
    date: text(args.date, world.date),
    lines: parseJournalLines(args.lines),
    agent: agentId,
  });
  if (res.ok) {
    pushEvent(world, agentId, 'ledger', {
      entryId: res.entry.id,
      memo: res.entry.memo,
      lines: res.entry.lines.map((l) => ({ ...l })),
    });
    return JSON.stringify({ ok: true, entryId: res.entry.id });
  }
  // Rejection becomes a public 'ledger' event noting the bounce.
  pushEvent(world, agentId, 'ledger', {
    rejected: true,
    rejectionId: res.rejection.id,
    reason: res.rejection.reason,
    memo: text(args.memo),
  });
  return JSON.stringify({ ok: false, reason: res.rejection.reason });
}

function handleSendEmail(
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
): string {
  const ev = pushEvent(world, agentId, 'email', { subject: text(args.subject) });
  const email = {
    id: nextEmailId(world),
    eventId: ev.id,
    from: agentId,
    to: textArray(args.to),
    cc: textArray(args.cc),
    subject: text(args.subject),
    body: text(args.body),
  };
  world.emails.push(email);
  ev.payload = { emailId: email.id, subject: email.subject, to: email.to };
  return JSON.stringify({ ok: true, emailId: email.id });
}

function handleWebSearch(
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
): string {
  // Phase 1: return canned but plausible UK headlines. Not public.
  const ev = pushEvent(
    world,
    agentId,
    'web_search',
    { query: text(args.query), results: CANNED_HEADLINES },
    { public: false },
  );
  return JSON.stringify({ ok: true, eventId: ev.id, results: CANNED_HEADLINES });
}

function handleIssueAnnouncement(
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
): string {
  const ev = pushEvent(world, agentId, 'announcement', {
    headline: text(args.headline),
    body: text(args.body),
  });
  world.announcements.push(ev);
  return JSON.stringify({ ok: true, eventId: ev.id });
}

function handleFileExpense(
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
): string {
  const ev = pushEvent(world, agentId, 'expense', {
    description: text(args.description),
    amountPence: int(args.amountPence),
    category: text(args.category, 'general') || 'general',
  });
  world.expenses.push(ev);
  return JSON.stringify({ ok: true, eventId: ev.id });
}

function handleScheduleMeeting(
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
): string {
  const ev = pushEvent(world, agentId, 'meeting', {
    title: text(args.title),
    attendees: textArray(args.attendees),
    when: text(args.when, 'TBC') || 'TBC',
  });
  world.meetings.push(ev);
  return JSON.stringify({ ok: true, eventId: ev.id });
}

function handleRespondToShareholder(
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
): string {
  // Modelled as a public email-ish event answering a queued question.
  const ev = pushEvent(world, agentId, 'email', {
    kind: 'shareholder_response',
    question: text(args.question, '(general)') || '(general)',
    response: text(args.response),
  });
  return JSON.stringify({ ok: true, eventId: ev.id });
}

function handleUpdateMemory(
  agentId: string,
  args: Record<string, unknown>,
  world: WorldState,
): string {
  world.memories[agentId] = text(args.memory);
  return JSON.stringify({ ok: true });
}

const HANDLERS: Record<string, ToolHandler> = {
  post_journal_entry: handlePostJournalEntry,
  send_email: handleSendEmail,
  web_search: handleWebSearch,
  issue_announcement: handleIssueAnnouncement,
  file_expense: handleFileExpense,
  schedule_meeting: handleScheduleMeeting,
  respond_to_shareholder: handleRespondToShareholder,
  update_memory: handleUpdateMemory,
};

// --- Tool execution with allowlist enforcement -----------------------------

/**
 * Execute one tool call for an agent, enforcing the allowlist. Returns a string
 * result fed back to the model. Disallowed tools return an explicit error string
 * (the permission matrix is part of the design).
 */
export function executeTool(
  agentId: string,
  name: string,
  args: unknown,
  world: WorldState,
): string {
  const allowed = TOOL_ALLOWLIST[agentId] ?? [];
  if (!allowed.includes(name)) {
    return JSON.stringify({
      ok: false,
      error: `Permission denied: agent '${agentId}' may not use tool '${name}'.`,
    });
  }
  const handler = HANDLERS[name];
  if (!handler) {
    return JSON.stringify({ ok: false, error: `Unknown tool '${name}'.` });
  }
  return handler(agentId, asRecord(args), world);
}

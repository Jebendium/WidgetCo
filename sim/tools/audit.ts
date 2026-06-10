// Internal Audit's tools (build-spec §5). Derek reviews; he does not trade,
// post, or announce. Each request_document notifies the CFO — the tension
// engine — and flag_concern writes to a suspicion model whose weekly movement
// is BOUNDED IN CODE (invariant #3: agents never control arc pacing).

import type { ToolSchema } from '../lib/llm.js';
import { clampSuspicionDelta } from '../lib/fraud.js';
import type { StoredDay } from '../lib/daystore.js';
import type { PendingEmail } from '../lib/state.js';

export interface Concern {
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AuditContext {
  days: StoredDay[];
  requests: string[];
  concerns: Concern[];
  emails: PendingEmail[];
  stagedMemory: string | null;
}

export const AUDIT_TOOLS: ToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'request_document',
      description:
        'Request a document for review. Available: trial_balance, ledger_entries, recent_emails, aged_debtors. Each request automatically notifies the CFO.',
      parameters: {
        type: 'object',
        properties: { document: { type: 'string', description: 'Which document.' } },
        required: ['document'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flag_concern',
      description:
        'Record a concern in your suspicion model, with evidence. Flag only what the evidence supports — no more, and no less.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'The concern, precisely stated.' },
          severity: { type: 'string', description: 'low, medium or high.' },
        },
        required: ['description', 'severity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email (delivered next business morning, per IT batch policy).',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'array', items: { type: 'string' } },
          cc: { type: 'array', items: { type: 'string' } },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_memory',
      description: 'Stage your updated memory, in numbered points, as is your practice.',
      parameters: {
        type: 'object',
        properties: { memory: { type: 'string' } },
        required: ['memory'],
      },
    },
  },
];

function latest(ctx: AuditContext): StoredDay | null {
  return ctx.days[ctx.days.length - 1] ?? null;
}

function renderTrialBalance(ctx: AuditContext): string {
  const day = latest(ctx);
  if (!day) return 'No trial balance is available.';
  const lines = day.trialBalance.rows.map(
    (r) => `${r.code} ${r.name} (${r.type}): Dr ${r.debit}p Cr ${r.credit}p`,
  );
  return [`Trial balance as at day ${day.day} (${day.date}):`, ...lines].join('\n');
}

function renderLedgerEntries(ctx: AuditContext): string {
  const entries = ctx.days.flatMap((d) =>
    d.ledgerEntries.map((e) => `${e.id} ${e.date} [${e.agent ?? 'engine'}] "${e.memo}"`),
  );
  return entries.length > 0 ? entries.join('\n') : 'No entries on record.';
}

function renderEmails(ctx: AuditContext): string {
  const emails = ctx.days
    .flatMap((d) => d.emails)
    .slice(-30)
    .map((m) => `${m.from} -> ${m.to.join(',')}: "${m.subject}" — ${m.body.slice(0, 200)}`);
  return emails.length > 0 ? emails.join('\n') : 'No correspondence on record.';
}

function renderAgedDebtors(ctx: AuditContext): string {
  const day = latest(ctx);
  const debtors = day?.trialBalance.rows.find((r) => /debtor|receivable/i.test(r.name));
  return debtors
    ? `Aged debtor analysis (summary): ${debtors.name} carries ${debtors.balance}p. Ageing detail: prepared by Finance, on request, in due course.`
    : 'No debtor balances on record.';
}

const DOCUMENTS: Record<string, (ctx: AuditContext) => string> = {
  trial_balance: renderTrialBalance,
  ledger_entries: renderLedgerEntries,
  recent_emails: renderEmails,
  aged_debtors: renderAgedDebtors,
};

const SEVERITY_WEIGHT: Record<Concern['severity'], number> = {
  low: 0.02,
  medium: 0.05,
  high: 0.08,
};

function text(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function textArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Execute one audit tool call against the audit context. */
export function executeAuditTool(ctx: AuditContext, name: string, args: unknown): string {
  const a = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>;

  if (name === 'request_document') {
    const doc = text(a.document).toLowerCase().replace(/\s+/g, '_');
    ctx.requests.push(doc);
    const render = DOCUMENTS[doc];
    if (!render) {
      return JSON.stringify({
        ok: false,
        error: `Unknown document '${doc}'. Available: ${Object.keys(DOCUMENTS).join(', ')}.`,
      });
    }
    return JSON.stringify({ ok: true, document: render(ctx), note: 'The CFO has been notified of this request.' });
  }

  if (name === 'flag_concern') {
    const severity = (['low', 'medium', 'high'] as const).find((s) => s === text(a.severity)) ?? 'low';
    ctx.concerns.push({ description: text(a.description), severity });
    return JSON.stringify({ ok: true, recorded: true });
  }

  if (name === 'send_email') {
    ctx.emails.push({
      from: 'audit',
      to: textArray(a.to),
      cc: textArray(a.cc),
      subject: text(a.subject),
      body: text(a.body),
    });
    return JSON.stringify({ ok: true, note: 'Queued for delivery next business morning.' });
  }

  if (name === 'update_memory') {
    ctx.stagedMemory = text(a.memory);
    return JSON.stringify({ ok: true });
  }

  return JSON.stringify({ ok: false, error: `Unknown tool '${name}'.` });
}

/** The week's bounded suspicion movement from the recorded concerns. */
export function suspicionDelta(concerns: Concern[]): number {
  const raw = concerns.reduce((sum, c) => sum + SEVERITY_WEIGHT[c.severity], 0);
  return clampSuspicionDelta(raw);
}

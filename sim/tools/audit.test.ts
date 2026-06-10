import { describe, it, expect } from 'vitest';
import { executeAuditTool, suspicionDelta, type AuditContext } from './audit.js';
import { MAX_WEEKLY_SUSPICION_DELTA } from '../lib/fraud.js';

function ctx(): AuditContext {
  return {
    days: [
      {
        day: 1,
        date: '2026-06-09',
        emails: [
          { from: 'sales', to: ['ceo'], cc: [], subject: 'PIPELINE FLASH', body: 'It is basically landing.' },
        ],
        ledgerEntries: [
          {
            id: 'JE-0002',
            date: '2026-06-09',
            memo: 'Heritage dispatch, recognised at the door',
            agent: 'cfo',
            lines: [{ account: '1300', debit: 100, credit: 0 }],
          },
        ],
        trialBalance: {
          rows: [
            { code: '1300', name: 'Trade Debtors (Receivables)', type: 'asset', debit: 100, credit: 0, balance: 100 },
          ],
          totalDebits: 100,
          totalCredits: 100,
          balances: true,
        },
      },
    ],
    requests: [],
    concerns: [],
    emails: [],
    stagedMemory: null,
  };
}

describe('executeAuditTool', () => {
  it('serves documents and notifies the CFO of every request', () => {
    const c = ctx();
    const res = JSON.parse(executeAuditTool(c, 'request_document', { document: 'trial_balance' })) as {
      ok: boolean;
      document: string;
      note: string;
    };
    expect(res.ok).toBe(true);
    expect(res.document).toContain('Trade Debtors');
    expect(res.note).toContain('CFO has been notified');
    expect(c.requests).toEqual(['trial_balance']);
  });

  it('refuses unknown documents with the available list', () => {
    const res = JSON.parse(
      executeAuditTool(ctx(), 'request_document', { document: 'the_truth' }),
    ) as { ok: boolean; error: string };
    expect(res.ok).toBe(false);
    expect(res.error).toContain('aged_debtors');
  });

  it('records concerns and queues Sunday emails for Monday', () => {
    const c = ctx();
    executeAuditTool(c, 'flag_concern', { description: 'Debtors outpacing revenue.', severity: 'high' });
    executeAuditTool(c, 'send_email', { to: ['cfo'], subject: 'IA-035', body: 'Further to my memo…' });
    expect(c.concerns).toEqual([{ description: 'Debtors outpacing revenue.', severity: 'high' }]);
    expect(c.emails[0]?.from).toBe('audit');
  });
});

describe('suspicionDelta — bounded in code', () => {
  it('weights by severity and clamps at the weekly maximum', () => {
    expect(suspicionDelta([{ description: 'x', severity: 'low' }])).toBeCloseTo(0.02);
    const many = Array.from({ length: 10 }, () => ({ description: 'x', severity: 'high' as const }));
    expect(suspicionDelta(many)).toBe(MAX_WEEKLY_SUSPICION_DELTA);
  });
});

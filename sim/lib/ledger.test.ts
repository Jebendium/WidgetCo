import { describe, it, expect } from 'vitest';
import { Ledger, simpleEntry } from './ledger.js';
import type { Account, JournalEntryInput } from './types.js';

const chart: Account[] = [
  { code: '1200', name: 'Bank', type: 'asset' },
  { code: '1100', name: 'Trade debtors', type: 'asset' },
  { code: '2100', name: 'Trade creditors', type: 'liability' },
  { code: '3000', name: 'Share capital', type: 'equity' },
  { code: '4000', name: 'Sales', type: 'income' },
  { code: '5000', name: 'Cost of sales', type: 'expense' },
];

function freshLedger(): Ledger {
  const l = new Ledger();
  l.loadChart(chart);
  return l;
}

describe('Ledger balance enforcement', () => {
  it('posts a balanced entry and assigns a JE id', () => {
    const l = freshLedger();
    const res = l.post(simpleEntry('Sale', '2026-06-09', '1200', '4000', 12000));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entry.id).toBe('JE-0001');
      expect(res.entry.suspicious).toBe(false);
    }
    expect(l.entries.length).toBe(1);
    expect(l.rejections.length).toBe(0);
  });

  it('rejects an unbalanced entry and logs it with a reason', () => {
    const l = freshLedger();
    const bad: JournalEntryInput = {
      memo: 'Wonky',
      date: '2026-06-09',
      lines: [
        { account: '1200', debit: 12000, credit: 0 },
        { account: '4000', debit: 0, credit: 11000 },
      ],
    };
    const res = l.post(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rejection.reason).toMatch(/Unbalanced/i);
      expect(res.rejection.id).toBe('REJ-0001');
    }
    expect(l.entries.length).toBe(0);
    expect(l.rejections.length).toBe(1);
  });

  it('rejects an entry referencing an unknown account', () => {
    const l = freshLedger();
    const res = l.post(simpleEntry('Mystery', '2026-06-09', '9999', '4000', 500));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rejection.reason).toMatch(/Unknown account/i);
  });

  it('rejects a line with both a debit and a credit', () => {
    const l = freshLedger();
    const bad: JournalEntryInput = {
      memo: 'Both sides',
      date: '2026-06-09',
      lines: [
        { account: '1200', debit: 500, credit: 500 },
        { account: '4000', debit: 0, credit: 500 },
      ],
    };
    const res = l.post(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rejection.reason).toMatch(/both a debit and a credit/i);
  });

  it('rejects a negative amount', () => {
    const l = freshLedger();
    const bad: JournalEntryInput = {
      memo: 'Negative',
      date: '2026-06-09',
      lines: [
        { account: '1200', debit: -500, credit: 0 },
        { account: '4000', debit: 0, credit: -500 },
      ],
    };
    const res = l.post(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rejection.reason).toMatch(/Negative/i);
  });

  it('does not throw for a balance failure — it logs and returns', () => {
    const l = freshLedger();
    expect(() =>
      l.post({
        memo: 'No throw',
        date: '2026-06-09',
        lines: [{ account: '1200', debit: 100, credit: 0 }],
      }),
    ).not.toThrow();
    expect(l.rejections.length).toBe(1);
  });
});

describe('Trial balance correctness', () => {
  it('keeps totalDebits === totalCredits after several posts', () => {
    const l = freshLedger();
    l.post(simpleEntry('Capital introduced', '2026-06-09', '1200', '3000', 5_000_00));
    l.post(simpleEntry('Sale on credit', '2026-06-09', '1100', '4000', 1_200_00));
    l.post(simpleEntry('Purchase on credit', '2026-06-09', '5000', '2100', 800_00));
    l.post(simpleEntry('Customer paid', '2026-06-09', '1200', '1100', 600_00));

    const tb = l.trialBalance();
    expect(tb.totalDebits).toBe(tb.totalCredits);
    expect(tb.balances).toBe(true);
  });

  it('reports balances:true even with a mix of account types', () => {
    const l = freshLedger();
    l.post(simpleEntry('Sale', '2026-06-09', '1200', '4000', 999_99));
    const tb = l.trialBalance();
    expect(tb.balances).toBe(true);
  });
});

describe('Rejection logging', () => {
  it('records a rejection in rejections[] with a clear reason', () => {
    const l = freshLedger();
    l.post({
      memo: 'Empty',
      date: '2026-06-09',
      lines: [],
    });
    expect(l.rejections.length).toBe(1);
    expect(l.rejections[0]?.reason.length).toBeGreaterThan(0);
  });
});

describe('markSuspicious', () => {
  it('flags an existing entry and ignores unknown ids', () => {
    const l = freshLedger();
    const res = l.post(simpleEntry('Sale', '2026-06-09', '1200', '4000', 100));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(l.markSuspicious(res.entry.id)).toBe(true);
      expect(l.entries[0]?.suspicious).toBe(true);
    }
    expect(l.markSuspicious('JE-9999')).toBe(false);
  });
});

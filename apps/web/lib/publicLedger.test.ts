import { describe, it, expect } from 'vitest';
import { visibleLedger, gbp } from './publicLedger';
import type { RawSimEvent, SimDayFile } from './types';

const NOW = new Date('2026-06-09T12:00:00+01:00');

function dayFile(events: RawSimEvent[], overrides: Partial<SimDayFile> = {}): SimDayFile {
  return {
    day: 1,
    date: '2026-06-09',
    fraudState: 'CLEAN',
    events,
    emails: [],
    ledgerEntries: [
      {
        id: 'JE-0001',
        memo: 'Opening balances',
        date: '2026-06-09',
        lines: [{ account: '1500', debit: 100, credit: 0 }],
        agent: 'cfo',
        postedAt: '2026-06-09T05:00:00Z',
        suspicious: false,
      },
      {
        id: 'JE-0002',
        memo: 'Heritage dispatch, recognised at the door',
        date: '2026-06-09',
        lines: [{ account: '1300', debit: 100, credit: 0 }],
        agent: 'cfo',
        postedAt: '2026-06-09T05:01:00Z',
        suspicious: true,
      },
    ],
    rejections: [],
    trialBalance: { rows: [], totalDebits: 0, totalCredits: 0, balances: true },
    shareAnchors: [],
    pokePool: [],
    recap: '',
    memories: {},
    ...overrides,
  };
}

function ledgerEvent(id: string, ts: string, entryId: string): RawSimEvent {
  return {
    id,
    day: 1,
    ts,
    agentId: 'cfo',
    kind: 'ledger',
    payload: { entryId },
    public: true,
  };
}

describe('visibleLedger', () => {
  it('shows unreferenced entries (the opening balance) immediately', () => {
    const out = visibleLedger(dayFile([]), NOW);
    expect(out.entries.map((e) => e.id)).toContain('JE-0001');
  });

  it('withholds an entry until its announcing event reveals', () => {
    const future = ledgerEvent('EV-1', '2026-06-09T16:00:00+01:00', 'JE-0002');
    const out = visibleLedger(dayFile([future]), NOW);
    expect(out.entries.map((e) => e.id)).toEqual(['JE-0001']);

    const past = ledgerEvent('EV-1', '2026-06-09T10:00:00+01:00', 'JE-0002');
    const out2 = visibleLedger(dayFile([past]), NOW);
    expect(out2.entries.map((e) => e.id)).toEqual(['JE-0001', 'JE-0002']);
  });

  it('NEVER serialises the suspicious flag', () => {
    const past = ledgerEvent('EV-1', '2026-06-09T10:00:00+01:00', 'JE-0002');
    const out = visibleLedger(dayFile([past]), NOW);
    expect(JSON.stringify(out)).not.toContain('suspicious');
    expect(JSON.stringify(out)).not.toContain('fraudState');
  });
});

describe('gbp', () => {
  it('formats pence as UK currency', () => {
    expect(gbp(445500000)).toBe('£4,455,000.00');
    expect(gbp(870)).toBe('£8.70');
    expect(gbp(-1450)).toBe('-£14.50');
  });
});

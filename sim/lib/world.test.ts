import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createWorld,
  loadChartFromCanon,
  loadOpeningBalancesFromCanon,
  seedOpeningBalances,
  FALLBACK_CHART,
} from './world.js';
import { getAgent, AGENTS, DAILY_AGENT_ORDER } from './agents.js';

function withTempFile(content: string, fn: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'widgetco-test-'));
  const path = join(dir, 'chart.md');
  writeFileSync(path, content, 'utf8');
  try {
    fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('loadChartFromCanon — markdown table parsing', () => {
  it('parses a well-formed markdown table', () => {
    const md = [
      '# Chart of accounts',
      '',
      '| Code | Name | Type |',
      '| ---- | ---- | ---- |',
      '| 1200 | Bank current account | Asset |',
      '| 2100 | Trade creditors | Liability |',
      '| 3000 | Share capital | Equity |',
      '| 4000 | Widget sales | Income |',
      '| 5000 | Cost of widgets sold | Expense |',
    ].join('\n');
    withTempFile(md, (path) => {
      const chart = loadChartFromCanon(path);
      expect(chart.length).toBe(5);
      expect(chart.find((a) => a.code === '1200')?.type).toBe('asset');
      expect(chart.find((a) => a.code === '4000')?.name).toBe('Widget sales');
    });
  });

  it('ignores rows that are not account rows and tolerates extra columns', () => {
    const md = [
      '| Code | Name | Notes | Type |',
      '| ---- | ---- | ----- | ---- |',
      '| not-a-code | Kettle | governance | Asset |',
      '| 1100 | Trade debtors | the classic tell | Asset |',
      '| 2100 | Trade creditors | | Liability |',
      '| 3000 | Share capital | | Equity |',
      '| 4000 | Widget sales | | Income |',
    ].join('\n');
    withTempFile(md, (path) => {
      const chart = loadChartFromCanon(path);
      expect(chart.length).toBe(4);
      expect(chart.find((a) => a.code === '1100')?.name).toBe('Trade debtors');
    });
  });

  it('falls back to the internal chart when the file is missing', () => {
    const chart = loadChartFromCanon(join(tmpdir(), 'does-not-exist', 'chart.md'));
    expect(chart).toBe(FALLBACK_CHART);
  });

  it('falls back when the file has too few parsable accounts', () => {
    withTempFile('just some prose, no table', (path) => {
      expect(loadChartFromCanon(path)).toBe(FALLBACK_CHART);
    });
  });
});

describe('loadOpeningBalancesFromCanon — opening trial balance table', () => {
  const md = [
    '| Code | Name | Type |',
    '| ---- | ---- | ---- |',
    '| 1300 | Trade Debtors | Asset |',
    '',
    '| Code | Account | Debit | Credit |',
    '|------|---------|------:|-------:|',
    '| 1300 | Trade Debtors | 540,000 | |',
    '| 3000 | Share Capital | | 540,000 |',
    '| | **Totals** | **540,000** | **540,000** |',
  ].join('\n');

  it('parses debit and credit lines, skipping the chart table and totals row', () => {
    withTempFile(md, (path) => {
      const lines = loadOpeningBalancesFromCanon(path);
      expect(lines).toEqual([
        { account: '1300', debit: 540_000_00, credit: 0 },
        { account: '3000', debit: 0, credit: 540_000_00 },
      ]);
    });
  });

  it('returns an empty list for a missing file', () => {
    expect(loadOpeningBalancesFromCanon(join(tmpdir(), 'nope', 'x.md'))).toEqual([]);
  });

  it('seeds the ledger from a canon opening TB when provided', () => {
    const world = createWorld(1, '2026-06-09');
    world.ledger.loadChart([
      { code: '1300', name: 'Trade Debtors', type: 'asset' },
      { code: '3000', name: 'Share Capital', type: 'equity' },
    ]);
    seedOpeningBalances(world, [
      { account: '1300', debit: 540_000_00, credit: 0 },
      { account: '3000', debit: 0, credit: 540_000_00 },
    ]);
    const tb = world.ledger.trialBalance();
    expect(tb.balances).toBe(true);
    expect(tb.totalDebits).toBe(540_000_00);
    expect(world.ledger.entries.length).toBe(1);
  });

  it('falls back to the chart-based seed when the canon opening does not post', () => {
    const world = createWorld(1, '2026-06-09');
    world.ledger.loadChart(FALLBACK_CHART);
    // References an account that does not exist -> ledger rejects -> fallback.
    seedOpeningBalances(world, [
      { account: '9999', debit: 100, credit: 0 },
      { account: '3000', debit: 0, credit: 100 },
    ]);
    const tb = world.ledger.trialBalance();
    expect(tb.balances).toBe(true);
    expect(tb.totalDebits).toBe(310_000_00);
    expect(world.ledger.rejections.length).toBe(1);
  });
});

describe('seedOpeningBalances', () => {
  it('posts a balanced opening trial balance with the full fallback chart', () => {
    const world = createWorld(1, '2026-06-09');
    world.ledger.loadChart(FALLBACK_CHART);
    seedOpeningBalances(world);

    expect(world.ledger.entries.length).toBe(1);
    expect(world.ledger.rejections.length).toBe(0);
    const tb = world.ledger.trialBalance();
    expect(tb.balances).toBe(true);
    expect(tb.totalDebits).toBe(310_000_00);
  });

  it('falls back to a simple balanced entry when most codes are missing', () => {
    const world = createWorld(1, '2026-06-09');
    world.ledger.loadChart([
      { code: '1200', name: 'Bank current account', type: 'asset' },
      { code: '3000', name: 'Share capital', type: 'equity' },
    ]);
    seedOpeningBalances(world);

    expect(world.ledger.entries.length).toBe(1);
    const tb = world.ledger.trialBalance();
    expect(tb.balances).toBe(true);
    expect(tb.totalDebits).toBe(100_000_00);
  });
});

describe('agents — identity contract', () => {
  it('resolves every daily agent and throws on unknown ids', () => {
    for (const id of DAILY_AGENT_ORDER) {
      expect(getAgent(id).id).toBe(id);
      expect(getAgent(id).daily).toBe(true);
    }
    expect(() => getAgent('intern')).toThrow(/Unknown agent/);
  });

  it('keeps audit and the regulator out of the daily tick', () => {
    expect(AGENTS.audit?.daily).toBe(false);
    expect(AGENTS.regulator?.daily).toBe(false);
    expect(DAILY_AGENT_ORDER).not.toContain('audit');
    expect(DAILY_AGENT_ORDER).not.toContain('regulator');
  });
});

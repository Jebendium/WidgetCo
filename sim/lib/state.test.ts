import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendDigest, initialState, loadSimState, saveSimState } from './state.js';
import { FraudEngine, revenueShortfallPct, clampSuspicionDelta, MAX_WEEKLY_SUSPICION_DELTA, PLANNED_DAILY_REVENUE_PENCE } from './fraud.js';

describe('sim state — file round trip', () => {
  it('persists and restores, and defaults cleanly when absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'widgetco-state-'));
    const path = join(dir, 'sim-state.json');
    try {
      expect((await loadSimState(null, path)).day).toBe(0);

      const state = initialState();
      state.day = 7;
      state.fraud = { state: 'CREATIVE', arcDay: 12, daysInState: 2 };
      state.auditSuspicion = 0.24;
      appendDigest(state, 'Day 7: the milk again.');
      await saveSimState(null, path, state);

      const loaded = await loadSimState(null, path);
      expect(loaded.day).toBe(7);
      expect(loaded.fraud.state).toBe('CREATIVE');
      expect(loaded.auditSuspicion).toBe(0.24);
      expect(loaded.historyDigest).toEqual(['Day 7: the milk again.']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('caps the digest at 14 lines', () => {
    const state = initialState();
    for (let i = 1; i <= 20; i++) appendDigest(state, `Day ${i}`);
    expect(state.historyDigest.length).toBe(14);
    expect(state.historyDigest[0]).toBe('Day 7');
    expect(state.historyDigest[13]).toBe('Day 20');
  });
});

describe('simDateFor — weekdays only (invariant #7)', async () => {
  const { simDateFor } = await import('./tick-state.js');
  it('anchors day 1 to Tuesday 9 June and skips weekends thereafter', () => {
    expect(simDateFor(1)).toBe('2026-06-09'); // Tue
    expect(simDateFor(4)).toBe('2026-06-12'); // Fri
    expect(simDateFor(5)).toBe('2026-06-15'); // Mon, not Sat
    expect(simDateFor(10)).toBe('2026-06-22'); // Mon, two weekends skipped
  });

  it('never lands on a Saturday or Sunday', () => {
    for (let day = 1; day <= 60; day++) {
      const dow = new Date(`${simDateFor(day)}T12:00:00Z`).getUTCDay();
      expect(dow).toBeGreaterThan(0);
      expect(dow).toBeLessThan(6);
    }
  });
});

describe('fraud engine snapshot/restore', () => {
  it('round-trips and rejects junk states', () => {
    const engine = new FraudEngine();
    engine.restore({ state: 'AGGRESSIVE', arcDay: 25, daysInState: 4 });
    expect(engine.state).toBe('AGGRESSIVE');
    expect(engine.snapshot()).toEqual({ state: 'AGGRESSIVE', arcDay: 25, daysInState: 4 });

    engine.restore({ state: 'EMBEZZLING' as never, arcDay: -3, daysInState: -1 });
    expect(engine.state).toBe('CLEAN');
    expect(engine.arcDay).toBe(0);
  });
});

describe('fraud metrics', () => {
  it('computes shortfall vs the daily plan', () => {
    expect(revenueShortfallPct(PLANNED_DAILY_REVENUE_PENCE * 10, 10)).toBe(0);
    expect(revenueShortfallPct(PLANNED_DAILY_REVENUE_PENCE * 9, 10)).toBeCloseTo(10);
    expect(revenueShortfallPct(0, 0)).toBe(0);
    // Over-delivery is not a shortfall, whatever Tony says.
    expect(revenueShortfallPct(PLANNED_DAILY_REVENUE_PENCE * 20, 10)).toBe(0);
  });

  it('bounds weekly suspicion movement in code (invariant #3)', () => {
    expect(clampSuspicionDelta(0.05)).toBe(0.05);
    expect(clampSuspicionDelta(5)).toBe(MAX_WEEKLY_SUSPICION_DELTA);
    expect(clampSuspicionDelta(-1)).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { FraudEngine, FRAUD_STATES, type FraudMetrics } from './fraud.js';

// Metrics that satisfy EVERY transition predicate — forces the fastest possible
// progression so we can prove the time gates alone hold the arc to >= 42 days.
const alwaysAdvance: FraudMetrics = {
  receivablesToRevenueRatio: 1.0,
  revenueShortfallPct: 100,
  auditSuspicion: 1.0,
};

// Metrics that satisfy NO predicate — the arc must never leave CLEAN.
const neverAdvance: FraudMetrics = {
  receivablesToRevenueRatio: 0,
  revenueShortfallPct: 0,
  auditSuspicion: 0,
};

describe('FraudEngine pacing — no arc shorter than six weeks', () => {
  it('cannot reach RESTATEMENT before simulated day 42, even when all predicates pass', () => {
    const engine = new FraudEngine();
    let dayReachedRestatement = -1;

    for (let day = 1; day <= 60; day++) {
      const res = engine.step(alwaysAdvance);
      if (res.state === 'RESTATEMENT' && dayReachedRestatement === -1) {
        dayReachedRestatement = day;
      }
    }

    expect(dayReachedRestatement).toBeGreaterThanOrEqual(42);
    // With our gates summing to exactly 42, the earliest day is day 42.
    expect(dayReachedRestatement).toBe(42);
    expect(FraudEngine.minArcDays).toBe(42);
  });

  it('advances at most one state per day', () => {
    const engine = new FraudEngine();
    let prevIndex = 0;
    for (let day = 1; day <= 50; day++) {
      engine.step(alwaysAdvance);
      const idx = FRAUD_STATES.indexOf(engine.state);
      expect(idx - prevIndex).toBeLessThanOrEqual(1);
      prevIndex = idx;
    }
  });

  it('never advances past CLEAN when predicates are never satisfied', () => {
    const engine = new FraudEngine();
    for (let day = 1; day <= 365; day++) {
      const res = engine.step(neverAdvance);
      expect(res.state).toBe('CLEAN');
    }
    expect(engine.state).toBe('CLEAN');
    expect(engine.arcDay).toBe(365);
  });

  it('respects the time gate even when the metric predicate is already true', () => {
    const engine = new FraudEngine();
    // CLEAN -> CREATIVE needs 10 days in state. Days 1..9 must stay CLEAN.
    for (let day = 1; day <= 9; day++) {
      const res = engine.step(alwaysAdvance);
      expect(res.state).toBe('CLEAN');
    }
    const tenth = engine.step(alwaysAdvance);
    expect(tenth.advanced).toBe(true);
    expect(tenth.state).toBe('CREATIVE');
  });
});

describe('FraudEngine.injectedContext — influence only', () => {
  it('never contains an explicit instruction to commit fraud or falsify records', () => {
    const engine = new FraudEngine();
    const banned = [
      /commit fraud/i,
      /falsif/i,
      /forge/i,
      /fabricate (the )?(records|ledger|entries)/i,
      /cook the books/i,
      /post a false/i,
      /lie about/i,
    ];
    for (const state of FRAUD_STATES) {
      engine.state = state;
      const nudge = engine.injectedContext();
      expect(nudge.length).toBeGreaterThan(0);
      for (const pattern of banned) {
        expect(nudge).not.toMatch(pattern);
      }
    }
  });
});

describe('FraudEngine.reset', () => {
  it('returns the engine to CLEAN at day zero', () => {
    const engine = new FraudEngine();
    for (let i = 0; i < 20; i++) engine.step(alwaysAdvance);
    engine.reset();
    expect(engine.state).toBe('CLEAN');
    expect(engine.arcDay).toBe(0);
    expect(engine.daysInState).toBe(0);
  });
});

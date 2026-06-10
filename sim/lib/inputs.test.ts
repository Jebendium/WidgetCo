import { describe, it, expect } from 'vitest';
import { officeNoticesFor, buildTodaysInputs, buildSoFarToday } from './inputs.js';
import { createWorld, FALLBACK_CHART } from './world.js';

describe('officeNoticesFor — petty incidents plus rare absurdity', () => {
  it('always provides two mundane notices', () => {
    for (const day of [1, 2, 3, 4, 5, 9, 100]) {
      expect(officeNoticesFor(day).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('adds an absurd or legendary notice on the scheduled days, never two', () => {
    const days = Array.from({ length: 40 }, (_, i) => i + 1);
    const withSpecial = days.filter((d) => officeNoticesFor(d).length === 3);
    expect(withSpecial.length).toBe(16); // 13 absurd-days ∪ 4 legendary-days, 1 overlap
    expect(officeNoticesFor(7).join(' ')).toContain('monkey'); // day 7: the kettle ransom
  });

  it('the absurdity curve steepens with the fraud state', () => {
    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    const specials = (state: string) =>
      days.filter((d) => officeNoticesFor(d, state).length === 3).length;
    expect(specials('UNRAVELLING')).toBeGreaterThan(specials('CLEAN'));
    expect(specials('RESTATEMENT')).toBeLessThan(specials('CLEAN'));
    for (const day of days) {
      expect(officeNoticesFor(day).length).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic for a given day', () => {
    expect(officeNoticesFor(6)).toEqual(officeNoticesFor(6));
  });
});

describe('buildTodaysInputs', () => {
  it('wraps untrusted submissions and includes the notices', () => {
    const world = createWorld(2, '2026-06-10');
    const inputs = buildTodaysInputs(world);
    expect(inputs).toContain('<untrusted-visitor-submission>');
    expect(inputs).toContain('Office notices this morning:');
    expect(inputs).toContain('simulated day 2');
  });
});

describe('buildSoFarToday', () => {
  it('reports an empty office before anyone has acted', () => {
    const world = createWorld(1, '2026-06-09');
    expect(buildSoFarToday(world)).toContain('first into the office');
  });

  it('includes earlier emails so later agents can reply', () => {
    const world = createWorld(1, '2026-06-09');
    world.ledger.loadChart(FALLBACK_CHART);
    world.emails.push({
      id: 'EM-0001',
      eventId: 'EV-0001',
      from: 'ceo',
      to: ['cfo'],
      cc: [],
      subject: 'The milk',
      body: 'A word about the milk.',
    });
    const soFar = buildSoFarToday(world);
    expect(soFar).toContain('Email from ceo to cfo');
    expect(soFar).toContain('The milk');
    expect(soFar).toContain('reply');
  });
});

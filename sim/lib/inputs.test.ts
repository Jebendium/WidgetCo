import { describe, it, expect } from 'vitest';
import { officeNoticesFor, buildTodaysInputs, buildSoFarToday } from './inputs.js';
import { createWorld, FALLBACK_CHART } from './world.js';

describe('officeNoticesFor — petty incidents plus rare absurdity', () => {
  it('always provides two mundane notices', () => {
    for (const day of [1, 2, 3, 4, 5, 9, 100]) {
      expect(officeNoticesFor(day).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('adds an absurd notice roughly one day in three, never two', () => {
    const days = Array.from({ length: 40 }, (_, i) => i + 1);
    const withAbsurd = days.filter((d) => officeNoticesFor(d).length === 3);
    expect(withAbsurd.length).toBe(13); // exactly 1 in 3
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

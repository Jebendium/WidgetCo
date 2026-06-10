import { describe, it, expect } from 'vitest';
import {
  assignTimestamps,
  allTimestampsInWindow,
  generatePokeLines,
} from './theatre.js';
import type { SimEvent } from './types.js';

function at<T>(arr: T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`missing index ${i}`);
  return v;
}

function makeEvents(n: number): SimEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `EV-${String(i + 1).padStart(4, '0')}`,
    day: 1,
    ts: '',
    agentId: 'ceo',
    kind: 'email' as const,
    payload: {},
    public: true,
  }));
}

describe('assignTimestamps — 09:00–17:30 window (hard acceptance)', () => {
  it('places a single event at the start of the window', () => {
    const events = makeEvents(1);
    assignTimestamps(events, '2026-06-09');
    expect(events[0]?.ts).toBe('2026-06-09T09:00:00+01:00');
  });

  it('spreads many events across the window, first at 09:00 and last at 17:30', () => {
    const events = makeEvents(50);
    assignTimestamps(events, '2026-06-09');
    expect(events[0]?.ts).toContain('T09:00');
    expect(events[49]?.ts).toContain('T17:30');
    expect(allTimestampsInWindow(events, '2026-06-09')).toBe(true);
  });

  it('keeps every timestamp in-window for any event count', () => {
    for (const n of [2, 3, 7, 100]) {
      const events = makeEvents(n);
      assignTimestamps(events, '2026-06-09');
      expect(allTimestampsInWindow(events, '2026-06-09')).toBe(true);
    }
  });

  it('uses BST (+01:00) in summer and GMT (+00:00) in winter', () => {
    const summer = makeEvents(1);
    assignTimestamps(summer, '2026-06-09');
    expect(summer[0]?.ts).toContain('+01:00');

    const winter = makeEvents(1);
    assignTimestamps(winter, '2026-01-12');
    expect(winter[0]?.ts).toContain('+00:00');
  });

  it('handles an empty event list without error', () => {
    const events: SimEvent[] = [];
    assignTimestamps(events, '2026-06-09');
    expect(events).toEqual([]);
  });
});

describe('allTimestampsInWindow', () => {
  it('rejects an event before 09:00', () => {
    const events = makeEvents(1);
    at(events, 0).ts = '2026-06-09T08:59:00+01:00';
    expect(allTimestampsInWindow(events, '2026-06-09')).toBe(false);
  });

  it('rejects an event after 17:30', () => {
    const events = makeEvents(1);
    at(events, 0).ts = '2026-06-09T17:31:00+01:00';
    expect(allTimestampsInWindow(events, '2026-06-09')).toBe(false);
  });

  it('rejects an event on the wrong date or with a missing ts', () => {
    const events = makeEvents(2);
    at(events, 0).ts = '2026-06-10T10:00:00+01:00';
    at(events, 1).ts = '';
    expect(allTimestampsInWindow(events, '2026-06-09')).toBe(false);
  });
});

describe('generatePokeLines', () => {
  it('generates the requested number of lines per agent', () => {
    const lines = generatePokeLines(['ceo', 'cfo'], 20);
    expect(lines.length).toBe(40);
    expect(lines.filter((l) => l.agentId === 'ceo').length).toBe(20);
    expect(lines.filter((l) => l.agentId === 'cfo').length).toBe(20);
  });
});

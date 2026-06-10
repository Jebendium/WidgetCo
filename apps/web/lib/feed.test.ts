import { describe, it, expect } from 'vitest';
import { gateEvents, gateAnchors, remapForReplay } from './feed';
import type { RawSimEvent, ShareAnchor } from './types';

const NOW = new Date('2026-06-09T12:00:00+01:00');

function ev(overrides: Partial<RawSimEvent>): RawSimEvent {
  return {
    id: 'EV-0001',
    day: 1,
    ts: '2026-06-09T10:00:00+01:00',
    agentId: 'ceo',
    kind: 'email',
    payload: { subject: 'The milk' },
    public: true,
    ...overrides,
  };
}

describe('gateEvents — events never leak before their scheduled ts', () => {
  it('reveals past events and withholds future payloads entirely', () => {
    const past = ev({ id: 'EV-PAST', ts: '2026-06-09T10:00:00+01:00' });
    const future = ev({
      id: 'EV-FUTURE',
      ts: '2026-06-09T16:00:00+01:00',
      payload: { subject: 'SECRET FUTURE SUBJECT' },
    });
    const gated = gateEvents([future, past], NOW);

    expect(gated.events.map((e) => e.id)).toEqual(['EV-PAST']);
    expect(gated.upcoming).toEqual([{ id: 'EV-FUTURE', ts: '2026-06-09T16:00:00+01:00' }]);
    // The future payload must not appear anywhere in the serialised output.
    expect(JSON.stringify(gated)).not.toContain('SECRET FUTURE SUBJECT');
  });

  it('treats an event exactly at now as revealed', () => {
    const gated = gateEvents([ev({ ts: NOW.toISOString() })], NOW);
    expect(gated.events.length).toBe(1);
  });

  it('never serialises the suspicious flag (hard invariant)', () => {
    const gated = gateEvents(
      [ev({ id: 'EV-SUS', suspicious: true, payload: { entryId: 'JE-0002' } })],
      NOW,
    );
    expect(gated.events.length).toBe(1);
    expect(JSON.stringify(gated)).not.toContain('suspicious');
  });

  it('omits non-public events from both lists', () => {
    const gated = gateEvents(
      [
        ev({ id: 'EV-PRIVATE', public: false, payload: { query: 'internal search' } }),
        ev({ id: 'EV-PRIVATE-FUTURE', public: false, ts: '2026-06-09T17:00:00+01:00' }),
      ],
      NOW,
    );
    expect(gated.events).toEqual([]);
    expect(gated.upcoming).toEqual([]);
  });

  it('withholds events with unparseable timestamps', () => {
    const gated = gateEvents([ev({ ts: '' }), ev({ id: 'EV-OK' })], NOW);
    expect(gated.events.map((e) => e.id)).toEqual(['EV-OK']);
  });

  it('preserves the interruptible flag (the canvas needs it)', () => {
    const gated = gateEvents([ev({ interruptible: true })], NOW);
    expect(gated.events[0]?.interruptible).toBe(true);
  });

  it('sorts revealed events by ts', () => {
    const gated = gateEvents(
      [
        ev({ id: 'B', ts: '2026-06-09T11:00:00+01:00' }),
        ev({ id: 'A', ts: '2026-06-09T09:30:00+01:00' }),
      ],
      NOW,
    );
    expect(gated.events.map((e) => e.id)).toEqual(['A', 'B']);
  });
});

describe('gateAnchors — future causes are spoilers', () => {
  it('serves only past anchors', () => {
    const anchors: ShareAnchor[] = [
      { ts: '2026-06-09T09:00:00+01:00', price: 1425, cause: 'Opening price' },
      { ts: '2026-06-09T17:00:00+01:00', price: 1100, cause: 'SECRET CRASH' },
    ];
    const out = gateAnchors(anchors, NOW);
    expect(out.length).toBe(1);
    expect(JSON.stringify(out)).not.toContain('SECRET CRASH');
  });
});

describe('remapForReplay', () => {
  it('maps the day span into the replay window preserving order', () => {
    const events = [
      ev({ id: 'FIRST', ts: '2026-06-09T09:00:00+01:00' }),
      ev({ id: 'MID', ts: '2026-06-09T13:15:00+01:00' }),
      ev({ id: 'LAST', ts: '2026-06-09T17:30:00+01:00' }),
    ];
    const remapped = remapForReplay(events, NOW);
    const times = remapped.map((e) => Date.parse(e.ts));
    expect(times[0]).toBeLessThan(times[1] ?? 0);
    expect(times[1]).toBeLessThan(times[2] ?? 0);
    const span = (times[2] ?? 0) - (times[0] ?? 0);
    expect(span).toBe(10 * 60 * 1000);
  });

  it('is deterministic within a window block', () => {
    const events = [ev({})];
    expect(remapForReplay(events, NOW)).toEqual(remapForReplay(events, NOW));
  });
});

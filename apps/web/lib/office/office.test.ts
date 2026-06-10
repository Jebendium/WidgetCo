import { describe, it, expect } from 'vitest';
import { collapseQueue, intentFor, MAX_ACTED_INTENTS, type AnimationIntent } from './intents';
import {
  atDesk,
  beginIntent,
  poke,
  stepAgent,
  PANIC_MS,
  type AgentSim,
} from './motion';
import { isOfficeOpen, closedCaption } from './hours';
import { WAYPOINTS, deskOf } from './waypoints';
import type { PublicEvent } from '../types';

function ev(overrides: Partial<PublicEvent>): PublicEvent {
  return {
    id: 'EV-1',
    day: 1,
    ts: '2026-06-09T10:00:00+01:00',
    agentId: 'cfo',
    kind: 'email',
    payload: {},
    ...overrides,
  };
}

describe('intentFor', () => {
  it('maps emails to typing at the desk and announcements to the printer', () => {
    expect(intentFor(ev({ kind: 'email' }))?.action).toBe('type');
    expect(intentFor(ev({ kind: 'email' }))?.target).toEqual(deskOf('cfo'));
    expect(intentFor(ev({ kind: 'announcement' }))?.target).toEqual(WAYPOINTS.printer);
    expect(intentFor(ev({ kind: 'meeting' }))?.action).toBe('meeting');
  });

  it('carries the interruptible flag through to the intent', () => {
    expect(intentFor(ev({ interruptible: true }))?.interruptible).toBe(true);
    expect(intentFor(ev({}))?.interruptible).toBe(false);
  });
});

describe('collapseQueue', () => {
  it('acts out everything when the backlog is small', () => {
    const intents = [intentFor(ev({ id: 'A' }))].filter(Boolean) as AnimationIntent[];
    const { collapse, act } = collapseQueue(intents);
    expect(collapse).toEqual([]);
    expect(act.length).toBe(1);
  });

  it('collapses all but the newest few of a large backlog', () => {
    const intents = Array.from({ length: 10 }, (_, i) =>
      intentFor(ev({ id: `E${i}` })),
    ).filter((i): i is AnimationIntent => i !== null);
    const { collapse, act } = collapseQueue(intents);
    expect(act.length).toBe(MAX_ACTED_INTENTS);
    expect(collapse.length).toBe(10 - MAX_ACTED_INTENTS);
    expect(act[act.length - 1]?.eventId).toBe('E9');
  });
});

describe('motion', () => {
  function walkUntilArrived(agent: AgentSim, maxSteps = 1000): AgentSim {
    let a = agent;
    let now = 1_000_000;
    for (let i = 0; i < maxSteps && a.state === 'walk'; i++) {
      now += 16;
      a = stepAgent(a, 16, now);
    }
    return a;
  }

  it('walks to the target and switches to the action state on arrival', () => {
    const intent = intentFor(ev({ kind: 'announcement', agentId: 'comms' }));
    expect(intent).not.toBeNull();
    if (!intent) return;
    const arrived = walkUntilArrived(beginIntent(atDesk('comms'), intent));
    expect(arrived.state).toBe('print');
    expect(arrived.x).toBe(WAYPOINTS.printer.x);
    expect(arrived.y).toBe(WAYPOINTS.printer.y);
  });

  it('returns to the desk after the hold expires', () => {
    const intent = intentFor(ev({ kind: 'meeting', agentId: 'cfo' }));
    if (!intent) return;
    let a = walkUntilArrived(beginIntent(atDesk('cfo'), intent));
    // Expire the hold, then walk home.
    a = stepAgent(a, 16, a.holdUntil + 1);
    expect(a.state).toBe('walk');
    a = walkUntilArrived(a);
    expect(a.state).toBe('idle');
    expect(a.x).toBe(deskOf('cfo').x);
  });

  it('a poke during a NON-interruptible walk changes nothing (indifference)', () => {
    const intent = intentFor(ev({ kind: 'email', agentId: 'ceo' }));
    if (!intent) return;
    const walking = beginIntent({ ...atDesk('ceo'), x: 0, y: 0 }, intent);
    const poked = poke(walking, 1_000_000);
    expect(poked.state).toBe('walk');
  });

  it('a poke during an INTERRUPTIBLE walk triggers panic and aborts the errand', () => {
    const intent = intentFor(ev({ kind: 'memo', agentId: 'cfo', interruptible: true }));
    if (!intent) return;
    expect(intent.action).toBe('shred');
    const walking = beginIntent({ ...atDesk('cfo'), x: 100, y: 100 }, intent);
    const now = 1_000_000;
    const panicked = poke(walking, now);
    expect(panicked.state).toBe('panic');
    expect(panicked.intent).toBeNull(); // the document goes unshredded
    expect(panicked.holdUntil).toBe(now + PANIC_MS);

    // After the panic, the agent heads back to its desk.
    const after = stepAgent(panicked, 16, now + PANIC_MS + 1);
    expect(after.state).toBe('walk');
    expect(after.target).toEqual(deskOf('cfo'));
  });
});

describe('office hours (UK)', () => {
  it('is open mid-morning on a weekday and closed at night', () => {
    expect(isOfficeOpen(new Date('2026-06-10T10:00:00+01:00'))).toBe(true);
    expect(isOfficeOpen(new Date('2026-06-10T22:00:00+01:00'))).toBe(false);
  });

  it('is closed at the weekend, with the Sunday clue in the caption', () => {
    expect(isOfficeOpen(new Date('2026-06-14T11:00:00+01:00'))).toBe(false); // a Sunday
    expect(closedCaption(new Date('2026-06-14T11:00:00+01:00'))).toContain('Internal Audit');
    expect(closedCaption(new Date('2026-06-10T22:00:00+01:00'))).toContain('kettle');
  });

  it('closes after 17:30 sharp', () => {
    expect(isOfficeOpen(new Date('2026-06-10T17:30:00+01:00'))).toBe(true);
    expect(isOfficeOpen(new Date('2026-06-10T17:31:00+01:00'))).toBe(false);
  });
});

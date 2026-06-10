// Mapping revealed feed events to animation intents, and the queue-collapse
// rule: if a visitor arrives mid-afternoon, nobody needs to watch four hours
// of waddling on fast-forward — older items resolve instantly (teleport to
// end state) and only the most recent few are acted out.

import type { PublicEvent } from '../types';
import { WAYPOINTS, deskOf, type Waypoint } from './waypoints';

export type AgentAction = 'type' | 'shred' | 'meeting' | 'kettle' | 'print';

export interface AnimationIntent {
  eventId: string;
  agentId: string;
  /** Where the agent walks to perform the action. */
  target: Waypoint;
  action: AgentAction;
  /** How long the action state holds on arrival, ms. */
  holdMs: number;
  /** Spec §8.5: a poke during an interruptible walk triggers the panic state. */
  interruptible: boolean;
}

/** How many queued intents are acted out in full; older ones collapse. */
export const MAX_ACTED_INTENTS = 4;

/** Map one revealed event to an intent, or null for events with no theatre. */
export function intentFor(ev: PublicEvent): AnimationIntent | null {
  const base = {
    eventId: ev.id,
    agentId: ev.agentId,
    interruptible: ev.interruptible === true,
  };
  switch (ev.kind) {
    case 'email':
      return { ...base, target: deskOf(ev.agentId), action: 'type', holdMs: 3000 };
    case 'ledger':
      return { ...base, target: deskOf(ev.agentId), action: 'type', holdMs: 3500 };
    case 'announcement':
      return { ...base, target: WAYPOINTS.printer, action: 'print', holdMs: 2500 };
    case 'meeting':
      return { ...base, target: WAYPOINTS.meeting_room_1, action: 'meeting', holdMs: 4000 };
    case 'expense':
      return { ...base, target: WAYPOINTS.printer, action: 'print', holdMs: 2000 };
    case 'memo':
      return { ...base, target: WAYPOINTS.shredder, action: 'shred', holdMs: 3000 };
    default:
      return null;
  }
}

/**
 * Collapse a backlog: return the intents to act out (the newest few) and the
 * ones to resolve instantly. Both lists preserve order.
 */
export function collapseQueue(intents: AnimationIntent[]): {
  collapse: AnimationIntent[];
  act: AnimationIntent[];
} {
  if (intents.length <= MAX_ACTED_INTENTS) return { collapse: [], act: intents };
  return {
    collapse: intents.slice(0, intents.length - MAX_ACTED_INTENTS),
    act: intents.slice(intents.length - MAX_ACTED_INTENTS),
  };
}

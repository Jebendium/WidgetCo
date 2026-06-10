// Per-frame agent motion and state resolution. Pure functions so the whole
// behaviour is unit-testable without a canvas.

import type { AgentAction, AnimationIntent } from './intents';
import { deskOf, type Waypoint } from './waypoints';

export type SpriteState = 'idle' | 'walk' | AgentAction | 'panic' | 'chat';

export interface AgentSim {
  id: string;
  x: number;
  y: number;
  state: SpriteState;
  /** Walk destination, when walking. */
  target: Waypoint | null;
  /** When the current hold (action/panic) ends, epoch ms. */
  holdUntil: number;
  /** The intent being performed, if any. */
  intent: AnimationIntent | null;
  facing: 1 | -1;
}

export function atDesk(agentId: string): AgentSim {
  const desk = deskOf(agentId);
  return {
    id: agentId,
    x: desk.x,
    y: desk.y,
    state: 'idle',
    target: null,
    holdUntil: 0,
    intent: null,
    facing: 1,
  };
}

export const WALK_SPEED = 60; // world px per second
const ARRIVE_EPSILON = 2;
export const PANIC_MS = 1600;

/** Begin performing an intent: set off walking toward its target. */
export function beginIntent(agent: AgentSim, intent: AnimationIntent): AgentSim {
  return {
    ...agent,
    state: 'walk',
    target: intent.target,
    intent,
    facing: intent.target.x >= agent.x ? 1 : -1,
  };
}

/** Resolve an intent instantly (queue collapse): teleport to the end state. */
export function teleportResolve(agent: AgentSim): AgentSim {
  const desk = deskOf(agent.id);
  return { ...agent, x: desk.x, y: desk.y, state: 'idle', target: null, intent: null, holdUntil: 0 };
}

/**
 * A poke lands on the agent. Default: bureaucratic indifference — no change
 * of stride. But a poke during an INTERRUPTIBLE walk aborts it: panic frames,
 * then back to the desk, document unshredded (spec §8.5).
 */
export function poke(agent: AgentSim, now: number): AgentSim {
  if (agent.state === 'walk' && agent.intent?.interruptible) {
    return { ...agent, state: 'panic', target: null, intent: null, holdUntil: now + PANIC_MS };
  }
  return agent;
}

function stepWalk(agent: AgentSim, dtMs: number, now: number): AgentSim {
  const target = agent.target;
  if (!target) return { ...agent, state: 'idle' };

  const dx = target.x - agent.x;
  const dy = target.y - agent.y;
  const dist = Math.hypot(dx, dy);
  const stepLen = (WALK_SPEED * dtMs) / 1000;

  if (dist <= Math.max(stepLen, ARRIVE_EPSILON)) {
    // Arrived: switch to the action state and hold it.
    const action = agent.intent?.action ?? 'idle';
    const holdMs = agent.intent?.holdMs ?? 0;
    return { ...agent, x: target.x, y: target.y, state: action, target: null, holdUntil: now + holdMs };
  }

  return {
    ...agent,
    x: agent.x + (dx / dist) * stepLen,
    y: agent.y + (dy / dist) * stepLen,
    facing: dx >= 0 ? 1 : -1,
  };
}

function stepHold(agent: AgentSim, now: number): AgentSim {
  if (now < agent.holdUntil) return agent;
  // Hold over: walk home (or simply become idle if already at the desk).
  const desk = deskOf(agent.id);
  const home = { ...agent, intent: null, holdUntil: 0 };
  if (Math.hypot(desk.x - agent.x, desk.y - agent.y) <= ARRIVE_EPSILON) {
    return { ...home, state: 'idle', target: null };
  }
  return { ...home, state: 'walk', target: desk, facing: desk.x >= agent.x ? 1 : -1 };
}

/** Advance one agent by dtMs of wall-clock time. */
export function stepAgent(agent: AgentSim, dtMs: number, now: number): AgentSim {
  switch (agent.state) {
    case 'walk':
      return stepWalk(agent, dtMs, now);
    case 'idle':
      return agent;
    default:
      // Action and panic states are holds that expire.
      return stepHold(agent, now);
  }
}

/** Idle agents with a queued intent pick up the next one. */
export function isAvailable(agent: AgentSim): boolean {
  return agent.state === 'idle' && agent.intent === null;
}

// --- Ambient life: wandering and corridor chats -------------------------------

export const CHAT_MS = 4200;
export const CHAT_RADIUS = 16;

/** Begin an aimless wander (no intent — arrival simply idles there). */
export function beginWander(agent: AgentSim, target: Waypoint): AgentSim {
  return {
    ...agent,
    state: 'walk',
    target,
    intent: null,
    facing: target.x >= agent.x ? 1 : -1,
  };
}

/**
 * May this agent be drawn into a corridor chat? Only ambient agents — never
 * one performing the feed's theatre (the plot outranks small talk).
 */
export function chatEligible(agent: AgentSim): boolean {
  if (agent.intent !== null) return false;
  return agent.state === 'walk' || agent.state === 'idle';
}

/** Two eligible agents close enough to fall into conversation? */
export function shouldChat(a: AgentSim, b: AgentSim): boolean {
  return (
    chatEligible(a) &&
    chatEligible(b) &&
    Math.hypot(a.x - b.x, a.y - b.y) <= CHAT_RADIUS &&
    (a.state === 'walk' || b.state === 'walk') // someone must have just arrived
  );
}

/** Stop and talk, facing the other party. Walks home when the chat expires. */
export function beginChat(agent: AgentSim, other: AgentSim, now: number): AgentSim {
  return {
    ...agent,
    state: 'chat',
    target: null,
    intent: null,
    holdUntil: now + CHAT_MS,
    facing: other.x >= agent.x ? 1 : -1,
  };
}

/** Stable key for a pair's chat cooldown. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

// Zustand store for the office canvas. The rAF loop reads this imperatively
// via useOfficeStore.getState() (hard rule: the loop mounts once and never
// depends on store state); React components subscribe only to the slow-moving
// slices (speech bubbles).

import { create } from 'zustand';
import type { PublicEvent } from '../types';
import { collapseQueue, intentFor, type AnimationIntent } from './intents';
import {
  atDesk,
  beginIntent,
  isAvailable,
  poke,
  stepAgent,
  teleportResolve,
  type AgentSim,
} from './motion';

export const OFFICE_AGENTS = ['ceo', 'cfo', 'sales', 'comms', 'middle-manager', 'audit'] as const;

export interface SpeechBubble {
  id: string;
  agentId: string;
  text: string;
  x: number;
  y: number;
  expiresAt: number;
}

const BUBBLE_MS = 4500;

interface OfficeState {
  agents: Record<string, AgentSim>;
  queue: AnimationIntent[];
  bubbles: SpeechBubble[];
  seenEventIds: Set<string>;
  bubbleSeq: number;

  /** Feed events arrive (already gated server-side); enqueue their theatre. */
  ingestEvents: (events: PublicEvent[]) => void;
  /** Advance the simulation by dtMs. Called from the rAF loop only. */
  tick: (dtMs: number, now: number) => void;
  /** A visitor pokes an agent: maybe panic, always say something. */
  pokeAgent: (agentId: string, line: string, now: number) => void;
  expireBubbles: (now: number) => void;
}

export const useOfficeStore = create<OfficeState>((set, get) => ({
  agents: Object.fromEntries(OFFICE_AGENTS.map((id) => [id, atDesk(id)])),
  queue: [],
  bubbles: [],
  seenEventIds: new Set<string>(),
  bubbleSeq: 0,

  ingestEvents: (events) => {
    const { seenEventIds, queue, agents } = get();
    const fresh = events.filter((e) => !seenEventIds.has(e.id));
    if (fresh.length === 0) return;

    const intents = fresh
      .map(intentFor)
      .filter((i): i is AnimationIntent => i !== null);
    const merged = [...queue, ...intents];
    const { collapse, act } = collapseQueue(merged);

    // Collapsed items resolve instantly: their agents teleport to end state.
    const nextAgents = { ...agents };
    for (const intent of collapse) {
      const agent = nextAgents[intent.agentId];
      if (agent) nextAgents[intent.agentId] = teleportResolve(agent);
    }

    const seen = new Set(seenEventIds);
    for (const e of fresh) seen.add(e.id);
    set({ agents: nextAgents, queue: act, seenEventIds: seen });
  },

  tick: (dtMs, now) => {
    const { agents, queue } = get();
    const nextAgents: Record<string, AgentSim> = {};
    let nextQueue = queue;

    for (const [id, agent] of Object.entries(agents)) {
      let a = stepAgent(agent, dtMs, now);
      if (isAvailable(a)) {
        const idx = nextQueue.findIndex((i) => i.agentId === id);
        if (idx >= 0) {
          const intent = nextQueue[idx];
          nextQueue = [...nextQueue.slice(0, idx), ...nextQueue.slice(idx + 1)];
          if (intent) a = beginIntent(a, intent);
        }
      }
      nextAgents[id] = a;
    }
    set({ agents: nextAgents, queue: nextQueue });
  },

  pokeAgent: (agentId, line, now) => {
    const { agents, bubbles, bubbleSeq } = get();
    const agent = agents[agentId];
    if (!agent) return;

    const bubble: SpeechBubble = {
      id: `b${bubbleSeq}`,
      agentId,
      text: line,
      x: agent.x,
      y: agent.y,
      expiresAt: now + BUBBLE_MS,
    };
    set({
      agents: { ...agents, [agentId]: poke(agent, now) },
      bubbles: [...bubbles.slice(-4), bubble],
      bubbleSeq: bubbleSeq + 1,
    });
  },

  expireBubbles: (now) => {
    const { bubbles } = get();
    const alive = bubbles.filter((b) => b.expiresAt > now);
    if (alive.length !== bubbles.length) set({ bubbles: alive });
  },
}));

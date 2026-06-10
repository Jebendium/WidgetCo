// Zustand store for the office canvas. The rAF loop reads this imperatively
// via useOfficeStore.getState() (hard rule: the loop mounts once and never
// depends on store state); React components subscribe only to the slow-moving
// slices (speech bubbles).

import { create } from 'zustand';
import type { PublicEvent } from '../types';
import { collapseQueue, intentFor, type AnimationIntent } from './intents';
import {
  atDesk,
  beginChat,
  beginIntent,
  beginWander,
  isAvailable,
  pairKey,
  poke,
  shouldChat,
  stepAgent,
  teleportResolve,
  type AgentSim,
} from './motion';
import { WAYPOINTS, deskOf } from './waypoints';

// Ambient wandering: roughly one stroll per agent per 40s of idle time.
const WANDER_CHANCE_PER_SEC = 0.025;
const CHAT_COOLDOWN_MS = 90_000;
const WANDER_SPOTS = [
  WAYPOINTS.kettle,
  WAYPOINTS.printer,
  WAYPOINTS.door,
  WAYPOINTS.meeting_room_1,
  WAYPOINTS.meeting_room_2,
];

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
  /** Agents who just fell into a chat and want a line fetched for them. */
  chatRequests: string[];
  chatCooldowns: Map<string, number>;

  /** Feed events arrive (already gated server-side); enqueue their theatre. */
  ingestEvents: (events: PublicEvent[]) => void;
  /** Advance the simulation by dtMs. Called from the rAF loop only. */
  tick: (dtMs: number, now: number) => void;
  /** A visitor pokes an agent: maybe panic, always say something. */
  pokeAgent: (agentId: string, line: string, now: number) => void;
  /** Attach a fetched line to an agent without poking them (corridor chat). */
  speak: (agentId: string, line: string, now: number) => void;
  /** Drain the pending chat-line requests (the UI fetches the lines). */
  takeChatRequests: () => string[];
  expireBubbles: (now: number) => void;
}

/** Step every agent; idle ones pick up queued intents or wander off. */
function advanceAgents(
  agents: Record<string, AgentSim>,
  queue: AnimationIntent[],
  dtMs: number,
  now: number,
): { agents: Record<string, AgentSim>; queue: AnimationIntent[] } {
  const nextAgents: Record<string, AgentSim> = {};
  let nextQueue = queue;

  for (const [id, agent] of Object.entries(agents)) {
    let a = stepAgent(agent, dtMs, now);
    if (isAvailable(a)) {
      const idx = nextQueue.findIndex((i) => i.agentId === id);
      const intent = idx >= 0 ? nextQueue[idx] : undefined;
      if (intent) {
        nextQueue = [...nextQueue.slice(0, idx), ...nextQueue.slice(idx + 1)];
        a = beginIntent(a, intent);
      } else if (Math.random() < (WANDER_CHANCE_PER_SEC * dtMs) / 1000) {
        a = beginWander(a, pickWanderSpot(id));
      }
    }
    nextAgents[id] = a;
  }
  return { agents: nextAgents, queue: nextQueue };
}

/** Mostly the kettle; sometimes home. As in life. */
function pickWanderSpot(agentId: string) {
  if (Math.random() < 0.4) return deskOf(agentId);
  return WANDER_SPOTS[Math.floor(Math.random() * WANDER_SPOTS.length)] ?? deskOf(agentId);
}

/** Corridor chats: ambient agents crossing paths stop and talk. Mutates agents. */
function applyChats(
  agents: Record<string, AgentSim>,
  cooldowns: Map<string, number>,
  now: number,
): string[] {
  const requests: string[] = [];
  const list = Object.values(agents);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!a || !b || !shouldChat(a, b)) continue;
      const key = pairKey(a.id, b.id);
      if ((cooldowns.get(key) ?? 0) > now) continue;
      cooldowns.set(key, now + CHAT_COOLDOWN_MS);
      agents[a.id] = beginChat(a, b, now);
      agents[b.id] = beginChat(b, a, now);
      requests.push(a.id, b.id);
    }
  }
  return requests;
}

export const useOfficeStore = create<OfficeState>((set, get) => ({
  agents: Object.fromEntries(OFFICE_AGENTS.map((id) => [id, atDesk(id)])),
  queue: [],
  bubbles: [],
  seenEventIds: new Set<string>(),
  bubbleSeq: 0,
  chatRequests: [],
  chatCooldowns: new Map<string, number>(),

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
    const { agents, queue, chatCooldowns } = get();
    const advanced = advanceAgents(agents, queue, dtMs, now);
    const chatRequests = applyChats(advanced.agents, chatCooldowns, now);

    set({
      agents: advanced.agents,
      queue: advanced.queue,
      ...(chatRequests.length > 0
        ? { chatRequests: [...get().chatRequests, ...chatRequests] }
        : {}),
    });
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

  speak: (agentId, line, now) => {
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
    set({ bubbles: [...bubbles.slice(-4), bubble], bubbleSeq: bubbleSeq + 1 });
  },

  takeChatRequests: () => {
    const { chatRequests } = get();
    if (chatRequests.length > 0) set({ chatRequests: [] });
    return chatRequests;
  },

  expireBubbles: (now) => {
    const { bubbles } = get();
    const alive = bubbles.filter((b) => b.expiresAt > now);
    if (alive.length !== bubbles.length) set({ bubbles: alive });
  },
}));

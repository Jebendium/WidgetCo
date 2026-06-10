// Placeholder sprite rendering: little code-drawn pixel people, one palette
// per officer, 8 animation frames per state. Deliberately janky — slight jank
// is the brand — and structured so PNG strip sheets (LimeZu Modern Interiors,
// purchased, loaded from the private bucket) can replace drawAgent later
// without touching the canvas loop.

import type { AgentSim } from './motion';

interface AgentPalette {
  suit: string;
  hair: string;
  tie: string;
}

const PALETTES: Record<string, AgentPalette> = {
  ceo: { suit: '#27496d', hair: '#b9b9b9', tie: '#8c6d1f' },
  cfo: { suit: '#2d4a3e', hair: '#7a4a2b', tie: '#5d6d7e' },
  sales: { suit: '#1f6fb2', hair: '#22211f', tie: '#d04a4a' },
  comms: { suit: '#5d3a66', hair: '#1d1a23', tie: '#c9a13b' },
  'middle-manager': { suit: '#6d5a44', hair: '#4a3c2a', tie: '#9aa364' },
  audit: { suit: '#55585e', hair: '#d8d8d8', tie: '#3e4a5e' },
};

const DEFAULT_PALETTE: AgentPalette = { suit: '#444', hair: '#222', tie: '#888' };
const SKIN = '#e8c39e';

interface Offsets {
  bob: number;
  arm: number;
  shake: number;
}

const OFFSET_FNS: Partial<Record<AgentSim['state'], (frame: number) => Offsets>> = {
  walk: (f) => ({ bob: f % 2, arm: 0, shake: 0 }),
  type: (f) => ({ bob: 0, arm: f % 2, shake: 0 }),
  print: (f) => ({ bob: 0, arm: f % 2, shake: 0 }),
  shred: (f) => ({ bob: 0, arm: f % 2 === 0 ? 2 : 0, shake: 0 }),
  panic: (f) => ({ bob: f % 2, arm: 2, shake: f % 2 === 0 ? -1 : 1 }),
  meeting: () => ({ bob: 0, arm: 0, shake: 0 }),
  chat: () => ({ bob: 0, arm: 0, shake: 0 }),
};

/** Per-frame vertical bob and arm wiggle, by state. */
function frameOffsets(state: AgentSim['state'], frame: number): Offsets {
  const fn = OFFSET_FNS[state];
  return fn ? fn(frame) : { bob: frame % 8 === 0 ? 1 : 0, arm: 0, shake: 0 };
}

/** Draw one agent at its world position. Replaceable by real sprite sheets. */
export function drawAgent(ctx: CanvasRenderingContext2D, agent: AgentSim, frame: number): void {
  const palette = PALETTES[agent.id] ?? DEFAULT_PALETTE;
  const { bob, arm, shake } = frameOffsets(agent.state, frame);
  const x = Math.round(agent.x) + shake;
  const y = Math.round(agent.y) - bob;

  // Body (suit), 10x12, anchored at feet.
  ctx.fillStyle = palette.suit;
  ctx.fillRect(x - 5, y - 12, 10, 12);
  // Arms: little cuffs that wiggle while typing/shredding.
  ctx.fillStyle = SKIN;
  ctx.fillRect(x - 7, y - 9 + arm, 2, 3);
  ctx.fillRect(x + 5, y - 9 + (arm === 0 ? 0 : 2 - arm), 2, 3);
  // Head.
  ctx.fillRect(x - 4, y - 20, 8, 8);
  // Hair.
  ctx.fillStyle = palette.hair;
  ctx.fillRect(x - 4, y - 21, 8, 3);
  // Tie.
  ctx.fillStyle = palette.tie;
  ctx.fillRect(x - 1 + agent.facing, y - 11, 2, 6);

  if (agent.state === 'panic') {
    ctx.fillStyle = '#c03030';
    ctx.fillRect(x - 1, y - 28, 2, 4);
    ctx.fillRect(x - 1, y - 23, 2, 2);
  }
}

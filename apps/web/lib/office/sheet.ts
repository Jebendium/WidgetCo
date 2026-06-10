// LimeZu character-sheet rendering (16x16 scale: frames are 16x32 on a 32px
// row grid). Maps our sprite states onto the pack's animation rows:
// type/meeting -> sit, print -> pick up, shred -> throw, panic -> hurt.
// The code-drawn placeholders in sprites.ts remain the fallback.

import type { AgentSim } from './motion';

const FRAME_W = 16;
const FRAME_H = 32;
const ROW_H = 32;

interface Anim {
  row: number;
  frames: number;
  /** Column offset by facing: [right, left]. Rows without left reuse right. */
  cols: [number, number];
  frameMs: number;
}

const ANIMS: Record<AgentSim['state'], Anim> = {
  idle: { row: 1, frames: 6, cols: [0, 12], frameMs: 200 },
  walk: { row: 2, frames: 6, cols: [0, 12], frameMs: 120 },
  type: { row: 4, frames: 6, cols: [0, 6], frameMs: 180 },
  meeting: { row: 5, frames: 6, cols: [0, 6], frameMs: 220 },
  print: { row: 9, frames: 6, cols: [0, 0], frameMs: 150 },
  shred: { row: 12, frames: 6, cols: [0, 0], frameMs: 130 },
  // The kettle deserves the phone-idle's contemplative quality (row 6).
  kettle: { row: 6, frames: 6, cols: [0, 0], frameMs: 220 },
  chat: { row: 1, frames: 6, cols: [0, 12], frameMs: 260 },
  panic: { row: 19, frames: 6, cols: [0, 0], frameMs: 90 },
};

/** Draw one agent from its sheet, feet anchored at (x, y). */
export function drawAgentFromSheet(
  ctx: CanvasRenderingContext2D,
  agent: AgentSim,
  img: HTMLImageElement,
  timestamp: number,
): void {
  const anim = ANIMS[agent.state];
  const frame = Math.floor(timestamp / anim.frameMs) % anim.frames;
  const col = (agent.facing === 1 ? anim.cols[0] : anim.cols[1]) + frame;
  const x = Math.round(agent.x);
  const y = Math.round(agent.y);

  ctx.drawImage(
    img,
    col * FRAME_W,
    anim.row * ROW_H,
    FRAME_W,
    FRAME_H,
    x - FRAME_W / 2,
    y - FRAME_H + 2,
    FRAME_W,
    FRAME_H,
  );

  if (agent.state === 'panic') {
    ctx.fillStyle = '#c03030';
    ctx.fillRect(x - 1, y - FRAME_H - 6, 2, 4);
    ctx.fillRect(x - 1, y - FRAME_H - 1, 2, 2);
  }
}

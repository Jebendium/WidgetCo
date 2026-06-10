// The office background: floor, desks, fixtures. Drawn flat each frame.
// Late-90s tycoon-game energy; the real tile sets replace this later.

import { WAYPOINTS, WORLD } from './waypoints';

const FLOOR_A = '#cfc6ae';
const FLOOR_B = '#c5bca3';
const DESK = '#8a6f4d';
const DESK_EDGE = '#6e5639';
const LABEL = '#5b5343';

function tile(ctx: CanvasRenderingContext2D): void {
  const size = 20;
  for (let ty = 0; ty < WORLD.height / size; ty++) {
    for (let tx = 0; tx < WORLD.width / size; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B;
      ctx.fillRect(tx * size, ty * size, size, size);
    }
  }
}

function desk(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = DESK;
  ctx.fillRect(x - 16, y - 4, 32, 12);
  ctx.fillStyle = DESK_EDGE;
  ctx.fillRect(x - 16, y + 6, 32, 2);
  // A monitor, off-white, of a certain age.
  ctx.fillStyle = '#ddd8c8';
  ctx.fillRect(x - 6, y - 12, 12, 9);
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(x - 4, y - 10, 8, 5);
}

function fixture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string,
  label: string,
): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = LABEL;
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 9);
}

export function drawScenery(ctx: CanvasRenderingContext2D): void {
  tile(ctx);

  for (const id of ['ceo', 'cfo', 'sales', 'comms', 'middle-manager', 'audit']) {
    const wp = WAYPOINTS[`${id}_desk` as keyof typeof WAYPOINTS];
    desk(ctx, wp.x, wp.y);
  }

  fixture(ctx, WAYPOINTS.printer.x, WAYPOINTS.printer.y, 22, 16, '#9b9b93', 'printer');
  fixture(ctx, WAYPOINTS.shredder.x, WAYPOINTS.shredder.y, 16, 14, '#7d7d77', 'shredder');
  fixture(ctx, WAYPOINTS.kettle.x, WAYPOINTS.kettle.y, 12, 10, '#e8e8e2', 'kettle');
  fixture(ctx, WAYPOINTS.meeting_room_1.x, WAYPOINTS.meeting_room_1.y, 60, 26, '#b8a888', 'meeting rm 1');
  fixture(ctx, WAYPOINTS.meeting_room_2.x, WAYPOINTS.meeting_room_2.y, 50, 24, '#a8b0b8', 'mtg rm 2 (cold)');

  // The brass SOAMES plate, above the kettle, as is tradition.
  ctx.fillStyle = '#caa84e';
  ctx.fillRect(WAYPOINTS.kettle.x - 8, WAYPOINTS.kettle.y - 18, 16, 4);
}

/** Dim the office and caption it when closed; one lamp on Sundays (a clue). */
export function drawClosed(ctx: CanvasRenderingContext2D, caption: string, sunday: boolean): void {
  ctx.fillStyle = 'rgba(10, 14, 28, 0.82)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  if (sunday) {
    const desk = WAYPOINTS.audit_desk;
    const glow = ctx.createRadialGradient(desk.x, desk.y - 8, 2, desk.x, desk.y - 8, 36);
    glow.addColorStop(0, 'rgba(255, 232, 170, 0.55)');
    glow.addColorStop(1, 'rgba(255, 232, 170, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(desk.x - 40, desk.y - 48, 80, 80);
  }

  ctx.fillStyle = '#d8d4c8';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(caption, WORLD.width / 2, WORLD.height / 2);
}

// The world outside the office: drawn over the widened background's plain
// ground. Left — the car park (space 11 reassigned to VISITORS, a matter of
// record). Right — Foundry Road and the tile wholesaler opposite, whose flat
// roof is where things that take kettles go to negotiate.

const TARMAC = '#a9a294';
const LINE = '#e8e2d2';
const GRASS = '#7d9c5e';

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, big = false): void {
  const s = big ? 1.4 : 1;
  ctx.fillStyle = '#7a5c3e';
  ctx.fillRect(x - 2, y - 8 * s, 4, 8 * s);
  ctx.fillStyle = '#4c7a44';
  ctx.fillRect(x - 9 * s, y - 22 * s, 18 * s, 14 * s);
  ctx.fillStyle = '#5d8c50';
  ctx.fillRect(x - 6 * s, y - 26 * s, 12 * s, 8 * s);
}

function car(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, 30, 14);
  ctx.fillStyle = '#cfe2ea';
  ctx.fillRect(x + 5, y + 3, 8, 8);
  ctx.fillRect(x + 17, y + 3, 8, 8);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x + 3, y - 2, 6, 3);
  ctx.fillRect(x + 21, y - 2, 6, 3);
  ctx.fillRect(x + 3, y + 13, 6, 3);
  ctx.fillRect(x + 21, y + 13, 6, 3);
}

function carPark(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = TARMAC;
  ctx.fillRect(40, 120, 340, 180);
  // Bays.
  ctx.fillStyle = LINE;
  for (let i = 0; i < 8; i++) ctx.fillRect(60 + i * 40, 130, 2, 60);
  for (let i = 0; i < 8; i++) ctx.fillRect(60 + i * 40, 220, 2, 60);
  // Cars in some bays; the gaps are flexible working.
  car(ctx, 66, 150, '#27496d');
  car(ctx, 146, 150, '#8b3a3a');
  car(ctx, 266, 150, '#b7a98c');
  car(ctx, 106, 235, '#4a5a48');
  car(ctx, 306, 235, '#5d3a66');
  // The lorry. One (1).
  ctx.fillStyle = '#d9d4c4';
  ctx.fillRect(48, 318, 56, 24);
  ctx.fillStyle = '#27496d';
  ctx.fillRect(96, 322, 16, 20);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(52, 340, 10, 4);
  ctx.fillRect(84, 340, 10, 4);
  ctx.fillRect(98, 340, 10, 4);
  // The company sign, a monolith of quiet authority.
  ctx.fillStyle = '#1f3a5f';
  ctx.fillRect(180, 70, 110, 34);
  ctx.fillStyle = '#caa84e';
  ctx.fillRect(180, 70, 110, 4);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('AMALGAMATED', 235, 84);
  ctx.fillText('WIDGET HOLDINGS plc', 235, 96);
  ctx.fillStyle = '#7a7460';
  ctx.fillRect(232, 104, 6, 16);
  // Hedge along the building.
  ctx.fillStyle = GRASS;
  ctx.fillRect(390, 130, 14, 260);
  // Greenery and incident.
  tree(ctx, 60, 110, true);
  tree(ctx, 340, 110);
  tree(ctx, 30, 420, true);
  tree(ctx, 200, 440);
  // An abandoned shopping trolley, origin unestablished.
  ctx.strokeStyle = '#9aa3ab';
  ctx.strokeRect(300, 380, 16, 10);
  ctx.fillStyle = '#9aa3ab';
  ctx.fillRect(298, 392, 3, 3);
  ctx.fillRect(314, 392, 3, 3);
  // Cones around nothing. The nothing is being assessed.
  ctx.fillStyle = '#d9742b';
  for (const [cx, cy] of [
    [150, 400],
    [170, 410],
    [150, 422],
    [130, 410],
  ] as const) {
    ctx.fillRect(cx, cy, 5, 8);
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(cx, cy + 3, 5, 2);
    ctx.fillStyle = '#d9742b';
  }
}

function foundryRoad(ctx: CanvasRenderingContext2D, t: number): void {
  // The road, running past the right of the building.
  ctx.fillStyle = '#8d8a80';
  ctx.fillRect(960, 0, 60, 544);
  ctx.fillStyle = LINE;
  for (let y = 8; y < 544; y += 40) ctx.fillRect(988, y, 4, 20);

  // THE TILE WHOLESALER, opposite. Its roof is load-bearing for the plot.
  ctx.fillStyle = '#9c6b4a';
  ctx.fillRect(1080, 100, 220, 140); // brickwork
  ctx.fillStyle = '#b07d58';
  for (let y = 108; y < 232; y += 12) {
    for (let x = 1086 + (y % 24 === 0 ? 6 : 0); x < 1290; x += 22) ctx.fillRect(x, y, 10, 4);
  }
  // The flat grey roof (visiting creatures sit at ~(1180, 96)).
  ctx.fillStyle = '#6e7276';
  ctx.fillRect(1072, 84, 236, 18);
  ctx.fillStyle = '#5a5e62';
  ctx.fillRect(1072, 98, 236, 4);
  // Signage. The wholesaler does not do subtle.
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(1100, 116, 180, 26);
  ctx.fillStyle = '#b03a2e';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TILES TILES TILES', 1190, 134);
  // Windows and door.
  ctx.fillStyle = '#9db8c8';
  ctx.fillRect(1100, 160, 40, 30);
  ctx.fillRect(1240, 160, 40, 30);
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(1175, 190, 30, 50);
  // Forecourt: pallets of tiles, presumably.
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(1100, 260, 26, 16);
  ctx.fillRect(1240, 256, 26, 16);
  ctx.fillStyle = '#a98f60';
  ctx.fillRect(1100, 272, 26, 4);
  ctx.fillRect(1240, 268, 26, 4);

  // A bus stop nobody alights at. The timetable blinks, wrongly.
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(1040, 330, 4, 40);
  ctx.fillRect(1030, 326, 24, 6);
  ctx.fillStyle = Math.floor(t / 1500) % 2 === 0 ? '#d7a93f' : '#6b5b2a';
  ctx.fillRect(1034, 336, 16, 10);

  // A skip, contents undisclosed.
  ctx.fillStyle = '#b08a2a';
  ctx.fillRect(1090, 420, 60, 26);
  ctx.fillStyle = '#8a6a1a';
  ctx.fillRect(1090, 420, 60, 6);

  // Trees the council planted and forgot.
  tree(ctx, 1320, 300, true);
  tree(ctx, 1250, 480);
  tree(ctx, 1060, 60);
}

/** Draw the world outside, over the background's plain ground. */
export function drawExterior(ctx: CanvasRenderingContext2D, t: number): void {
  carPark(ctx);
  foundryRoad(ctx, t);
}

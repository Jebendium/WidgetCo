// The world outside the office. The building occupies x 320-1024 of the
// 1344-wide world; the grounds are 0-320 (car park) and 1024-1344 (Foundry
// Road and the tile wholesaler, whose flat roof is where things that take
// kettles go to negotiate).

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
  ctx.fillRect(x, y, 26, 13);
  ctx.fillStyle = '#cfe2ea';
  ctx.fillRect(x + 4, y + 3, 7, 7);
  ctx.fillRect(x + 15, y + 3, 7, 7);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x + 2, y - 2, 5, 3);
  ctx.fillRect(x + 18, y - 2, 5, 3);
  ctx.fillRect(x + 2, y + 12, 5, 3);
  ctx.fillRect(x + 18, y + 12, 5, 3);
}

function carPark(ctx: CanvasRenderingContext2D): void {
  // Grounds run x 0-315 only; the building starts at 320.
  ctx.fillStyle = TARMAC;
  ctx.fillRect(16, 120, 288, 180);
  ctx.fillStyle = LINE;
  for (let i = 0; i < 8; i++) ctx.fillRect(28 + i * 34, 130, 2, 56);
  for (let i = 0; i < 8; i++) ctx.fillRect(28 + i * 34, 224, 2, 56);
  car(ctx, 32, 146, '#27496d');
  car(ctx, 100, 146, '#8b3a3a');
  car(ctx, 202, 146, '#b7a98c');
  car(ctx, 66, 240, '#4a5a48');
  car(ctx, 236, 240, '#5d3a66');
  // The lorry. One (1).
  ctx.fillStyle = '#d9d4c4';
  ctx.fillRect(24, 322, 52, 22);
  ctx.fillStyle = '#27496d';
  ctx.fillRect(70, 326, 15, 18);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(28, 342, 9, 4);
  ctx.fillRect(56, 342, 9, 4);
  ctx.fillRect(72, 342, 9, 4);
  // The company sign, a monolith of quiet authority.
  ctx.fillStyle = '#1f3a5f';
  ctx.fillRect(96, 60, 116, 34);
  ctx.fillStyle = '#caa84e';
  ctx.fillRect(96, 60, 116, 4);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('AMALGAMATED', 154, 74);
  ctx.fillText('WIDGET HOLDINGS plc', 154, 86);
  ctx.fillStyle = '#7a7460';
  ctx.fillRect(151, 94, 6, 16);
  // Hedge along the building line.
  ctx.fillStyle = GRASS;
  ctx.fillRect(306, 130, 10, 260);
  // Greenery and incident.
  tree(ctx, 40, 112, true);
  tree(ctx, 262, 108);
  tree(ctx, 30, 430, true);
  tree(ctx, 196, 446);
  // An abandoned shopping trolley, origin unestablished.
  ctx.strokeStyle = '#9aa3ab';
  ctx.strokeRect(252, 384, 16, 10);
  ctx.fillStyle = '#9aa3ab';
  ctx.fillRect(250, 396, 3, 3);
  ctx.fillRect(266, 396, 3, 3);
  // Cones around nothing. The nothing is being assessed.
  ctx.fillStyle = '#d9742b';
  for (const [cx, cy] of [
    [140, 400],
    [160, 410],
    [140, 422],
    [120, 410],
  ] as const) {
    ctx.fillRect(cx, cy, 5, 8);
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(cx, cy + 3, 5, 2);
    ctx.fillStyle = '#d9742b';
  }
}

function foundryRoad(ctx: CanvasRenderingContext2D, t: number): void {
  // The road, in the gap east of the building (building ends at 1024).
  ctx.fillStyle = '#8d8a80';
  ctx.fillRect(1036, 0, 56, 544);
  ctx.fillStyle = LINE;
  for (let y = 8; y < 544; y += 40) ctx.fillRect(1062, y, 4, 20);

  // THE TILE WHOLESALER, opposite. Its roof is load-bearing for the plot.
  ctx.fillStyle = '#9c6b4a';
  ctx.fillRect(1120, 100, 210, 140);
  ctx.fillStyle = '#b07d58';
  for (let y = 108; y < 232; y += 12) {
    for (let x = 1126 + (y % 24 === 0 ? 6 : 0); x < 1322; x += 22) ctx.fillRect(x, y, 10, 4);
  }
  // The flat grey roof (visiting creatures sit at ~(1220, 96)).
  ctx.fillStyle = '#6e7276';
  ctx.fillRect(1112, 84, 226, 18);
  ctx.fillStyle = '#5a5e62';
  ctx.fillRect(1112, 98, 226, 4);
  // Signage. The wholesaler does not do subtle.
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(1138, 116, 174, 26);
  ctx.fillStyle = '#b03a2e';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TILES TILES TILES', 1225, 134);
  // Windows and door.
  ctx.fillStyle = '#9db8c8';
  ctx.fillRect(1138, 160, 38, 30);
  ctx.fillRect(1276, 160, 38, 30);
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(1212, 190, 28, 50);
  // Forecourt: pallets of tiles, presumably.
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(1138, 260, 26, 16);
  ctx.fillRect(1280, 256, 26, 16);
  ctx.fillStyle = '#a98f60';
  ctx.fillRect(1138, 272, 26, 4);
  ctx.fillRect(1280, 268, 26, 4);

  // A bus stop nobody alights at. The timetable blinks, wrongly.
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(1102, 330, 4, 40);
  ctx.fillRect(1094, 326, 22, 6);
  ctx.fillStyle = Math.floor(t / 1500) % 2 === 0 ? '#d7a93f' : '#6b5b2a';
  ctx.fillRect(1097, 336, 15, 10);

  // A skip, contents undisclosed.
  ctx.fillStyle = '#b08a2a';
  ctx.fillRect(1130, 420, 60, 26);
  ctx.fillStyle = '#8a6a1a';
  ctx.fillRect(1130, 420, 60, 6);

  // Trees the council planted and forgot.
  tree(ctx, 1326, 300, true);
  tree(ctx, 1262, 480);
  tree(ctx, 1110, 56);
}

/** Draw the world outside, over the background's plain ground. */
export function drawExterior(ctx: CanvasRenderingContext2D, t: number): void {
  carPark(ctx);
  foundryRoad(ctx, t);
}

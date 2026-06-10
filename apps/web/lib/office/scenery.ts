// The office set: walls, windows, zoned flooring, furniture, and the small
// institutional details that reward a wandering eye (comedy bible rule 11:
// reward the curious). Code-drawn; the LimeZu office tiles can replace this
// wholesale later without touching the loop.

import { WAYPOINTS, WORLD } from './waypoints';

const WALL_H = 36;

// Deterministic per-tile variation (no Math.random in the render path).
function tileNoise(tx: number, ty: number): number {
  const n = Math.sin(tx * 127.1 + ty * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function floor(ctx: CanvasRenderingContext2D): void {
  // Warm wooden boards with deterministic grain variation.
  const size = 20;
  for (let ty = WALL_H / size; ty < WORLD.height / size; ty++) {
    for (let tx = 0; tx < WORLD.width / size; tx++) {
      const v = tileNoise(tx, ty);
      const base = 200 + Math.floor(v * 14);
      ctx.fillStyle = `rgb(${base}, ${base - 28}, ${base - 64})`;
      ctx.fillRect(tx * size, ty * size, size, size);
      ctx.fillStyle = 'rgba(110, 80, 50, 0.18)';
      ctx.fillRect(tx * size, ty * size + size - 1, size, 1);
    }
  }

  // The blue institutional carpet under the desk cluster. Hard-wearing. Grey-blue.
  ctx.fillStyle = '#9aa7b4';
  ctx.fillRect(40, 44, 320, 180);
  ctx.fillStyle = 'rgba(70, 85, 100, 0.25)';
  for (let x = 48; x < 352; x += 16) ctx.fillRect(x, 46, 1, 176);

  // Kitchenette lino, easy to mop, often mopped.
  ctx.fillStyle = '#cfd8d2';
  ctx.fillRect(200, 252, 110, 68);

  // Meeting Room 2 (the Soames shed): visibly colder.
  ctx.fillStyle = '#b9c4cc';
  ctx.fillRect(16, 246, 110, 74);
}

function walls(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.fillStyle = '#d8d2c0';
  ctx.fillRect(0, 0, WORLD.width, WALL_H);
  ctx.fillStyle = '#b8b099';
  ctx.fillRect(0, WALL_H - 4, WORLD.width, 4);

  // Windows onto a Wolverhampton sky, with venetian blinds at varied droop.
  for (let i = 0; i < 4; i++) {
    const x = 36 + i * 116;
    ctx.fillStyle = '#9db8c8';
    ctx.fillRect(x, 6, 44, 22);
    ctx.fillStyle = '#c5d6de';
    ctx.fillRect(x, 6, 44, 6); // overcast band
    ctx.fillStyle = '#8a8262';
    const droop = [10, 18, 6, 14][i] ?? 10;
    for (let b = 0; b < droop; b += 4) ctx.fillRect(x, 6 + b, 44, 2);
    ctx.strokeStyle = '#7a7460';
    ctx.strokeRect(x - 0.5, 5.5, 45, 23);
  }

  // The clock. It is correct twice a day, which the Company minutes as 100%.
  const cx = 240;
  ctx.fillStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.arc(cx, 16, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.stroke();
  const mins = (t / 60000) % 60;
  ctx.beginPath();
  ctx.moveTo(cx, 16);
  ctx.lineTo(cx + Math.sin((mins / 60) * Math.PI * 2) * 6, 16 - Math.cos((mins / 60) * Math.PI * 2) * 6);
  ctx.stroke();

  // The noticeboard: four notices, one of them at an angle nobody corrects.
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(322, 6, 40, 24);
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(326, 10, 8, 7);
  ctx.fillRect(338, 10, 8, 7);
  ctx.fillRect(326, 20, 8, 7);
  ctx.save();
  ctx.translate(344, 23);
  ctx.rotate(0.18);
  ctx.fillRect(-4, -3, 8, 7);
  ctx.restore();
}

function desk(ctx: CanvasRenderingContext2D, x: number, y: number, papers: boolean): void {
  // Chair, behind.
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(x - 5, y - 16, 10, 6);
  // Desk top with edge shadow.
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(x - 18, y - 6, 36, 14);
  ctx.fillStyle = '#6e5639';
  ctx.fillRect(x - 18, y + 6, 36, 3);
  // CRT monitor of a certain age, with a live screen flicker.
  ctx.fillStyle = '#ddd8c8';
  ctx.fillRect(x - 7, y - 16, 13, 11);
  ctx.fillStyle = '#2e4536';
  ctx.fillRect(x - 5, y - 14, 9, 7);
  ctx.fillStyle = 'rgba(140, 220, 160, 0.5)';
  ctx.fillRect(x - 5, y - 14, 9, 1);
  if (papers) {
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(x + 8, y - 4, 7, 5);
    ctx.fillRect(x - 16, y - 5, 6, 4);
  }
}

function kitchenette(ctx: CanvasRenderingContext2D, t: number): void {
  const k = WAYPOINTS.kettle;
  // Counter.
  ctx.fillStyle = '#b8b0a0';
  ctx.fillRect(k.x - 28, k.y - 12, 56, 18);
  ctx.fillStyle = '#999180';
  ctx.fillRect(k.x - 28, k.y + 4, 56, 3);
  // The kettle (the fourth kettle). White, 1.7 litres, governed.
  ctx.fillStyle = '#f0ede2';
  ctx.fillRect(k.x - 5, k.y - 22, 10, 11);
  ctx.fillRect(k.x + 4, k.y - 19, 3, 4); // spout
  // Steam, periodically. The descaling schedule is working.
  if (Math.floor(t / 4000) % 3 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const phase = Math.floor(t / 300) % 4;
    ctx.fillRect(k.x + 5, k.y - 28 - phase, 2, 2);
    ctx.fillRect(k.x + 7, k.y - 33 - phase, 2, 2);
  }
  // The brass SOAMES plate, above, as is tradition.
  ctx.fillStyle = '#caa84e';
  ctx.fillRect(k.x - 10, k.y - 36, 20, 5);
  ctx.fillStyle = '#8a6d1f';
  ctx.font = '4px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SOAMES', k.x, k.y - 32);
  // Mugs. One says something nobody can read at this resolution.
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(k.x - 22, k.y - 16, 5, 5);
  ctx.fillStyle = '#2e6da4';
  ctx.fillRect(k.x - 14, k.y - 16, 5, 5);
  // The fridge, containing the milk, labelled.
  ctx.fillStyle = '#e8e8e2';
  ctx.fillRect(k.x + 34, k.y - 30, 16, 36);
  ctx.fillStyle = '#c8c8c0';
  ctx.fillRect(k.x + 34, k.y - 14, 16, 2);
}

function fixtures(ctx: CanvasRenderingContext2D, t: number): void {
  const p = WAYPOINTS.printer;
  // The printer that occupies Albert Pemberton's former office.
  ctx.fillStyle = '#9b9b93';
  ctx.fillRect(p.x - 13, p.y - 18, 26, 18);
  ctx.fillStyle = '#7d7d77';
  ctx.fillRect(p.x - 15, p.y - 4, 30, 5);
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(p.x - 9, p.y - 21, 18, 4); // paper tray
  // Status light: blinks amber. It has always blinked amber.
  ctx.fillStyle = Math.floor(t / 700) % 2 === 0 ? '#d49a2a' : '#6b5b2a';
  ctx.fillRect(p.x + 8, p.y - 14, 3, 3);

  const s = WAYPOINTS.shredder;
  // The shredder, responsibility of nobody, displaying its unknown red light.
  ctx.fillStyle = '#7d7d77';
  ctx.fillRect(s.x - 9, s.y - 16, 18, 16);
  ctx.fillStyle = '#3a3a36';
  ctx.fillRect(s.x - 7, s.y - 15, 14, 3);
  ctx.fillStyle = Math.floor(t / 1100) % 2 === 0 ? '#c03030' : '#5a2020';
  ctx.fillRect(s.x + 4, s.y - 11, 3, 3);
  ctx.fillStyle = '#f4f1e6'; // strips in the bin
  ctx.fillRect(s.x - 6, s.y - 7, 2, 5);
  ctx.fillRect(s.x - 2, s.y - 8, 2, 6);
  ctx.fillRect(s.x + 2, s.y - 6, 2, 4);

  // Water cooler: the other parliament.
  ctx.fillStyle = '#dfe8ee';
  ctx.fillRect(150, 240, 12, 10);
  ctx.fillStyle = '#aac4d4';
  ctx.fillRect(151, 232, 10, 9);
  ctx.fillStyle = '#8898a4';
  ctx.fillRect(149, 250, 14, 12);

  // Filing cabinets along the right wall, one drawer permanently open.
  for (let i = 0; i < 3; i++) {
    const y = 90 + i * 30;
    ctx.fillStyle = '#8d9296';
    ctx.fillRect(456, y, 18, 24);
    ctx.fillStyle = '#6f7478';
    ctx.fillRect(458, y + 3, 14, 4);
    ctx.fillRect(458, y + 10, 14, 4);
    ctx.fillRect(458, y + 17, 14, 4);
  }
  ctx.fillStyle = '#6f7478';
  ctx.fillRect(452, 124, 22, 4); // the open drawer (FY2019, mid-refile)

  // Plants. The successor to Bramble, and a spare, in case.
  for (const [px, py] of [
    [30, 70],
    [430, 300],
  ] as const) {
    ctx.fillStyle = '#9c5a3c';
    ctx.fillRect(px - 4, py - 6, 8, 6);
    ctx.fillStyle = '#3e7a4a';
    ctx.fillRect(px - 6, py - 14, 4, 8);
    ctx.fillRect(px + 2, py - 14, 4, 8);
    ctx.fillRect(px - 2, py - 18, 4, 12);
  }

  // Archive boxes by Internal Audit's desk. Cross-referenced. Both series.
  const a = WAYPOINTS.audit_desk;
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(a.x + 22, a.y - 10, 14, 9);
  ctx.fillRect(a.x + 24, a.y - 19, 14, 9);
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(a.x + 22, a.y - 6, 14, 1);
  ctx.fillRect(a.x + 24, a.y - 15, 14, 1);

  // The door, and the mat that says nothing.
  ctx.fillStyle = '#6e5639';
  ctx.fillRect(2, 140, 8, 40);
  ctx.fillStyle = '#8a7a5a';
  ctx.fillRect(10, 150, 14, 22);

  // Radiator under the first window. Meeting Room 2 is beyond its reach.
  ctx.fillStyle = '#cfc9b8';
  ctx.fillRect(40, 38, 36, 8);
  ctx.fillStyle = '#b3ac98';
  for (let x = 42; x < 74; x += 5) ctx.fillRect(x, 39, 2, 6);
}

function rooms(ctx: CanvasRenderingContext2D): void {
  // Meeting Room 1: a table, six chairs, a flip chart with one word on it.
  const m = WAYPOINTS.meeting_room_1;
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(m.x - 30, m.y - 12, 60, 20);
  ctx.fillStyle = '#6e5639';
  ctx.fillRect(m.x - 30, m.y + 6, 60, 3);
  ctx.fillStyle = '#3a3f4a';
  for (const dx of [-22, 0, 22]) {
    ctx.fillRect(m.x + dx - 4, m.y - 22, 8, 6);
    ctx.fillRect(m.x + dx - 4, m.y + 12, 8, 6);
  }
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(m.x + 38, m.y - 24, 14, 18);
  ctx.fillStyle = '#6e5639';
  ctx.fillRect(m.x + 44, m.y - 6, 2, 8);

  // Meeting Room 2: the Soames shed. A table, two chairs, a sense of history.
  const m2 = WAYPOINTS.meeting_room_2;
  ctx.fillStyle = '#a8b0b8';
  ctx.fillRect(m2.x - 24, m2.y - 10, 48, 16);
  ctx.fillStyle = '#8a929a';
  ctx.fillRect(m2.x - 24, m2.y + 4, 48, 3);
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(m2.x - 14, m2.y - 18, 8, 6);
  ctx.fillRect(m2.x + 8, m2.y - 18, 8, 6);
}

function wallArt(ctx: CanvasRenderingContext2D): void {
  // Portrait of Albert Pemberton, gazing at the printer that took his office.
  ctx.fillStyle = '#6e5639';
  ctx.fillRect(414, 6, 22, 26);
  ctx.fillStyle = '#d8cdb8';
  ctx.fillRect(417, 9, 16, 20);
  ctx.fillStyle = '#5a514a';
  ctx.fillRect(421, 13, 8, 8); // the great man
  ctx.fillRect(423, 21, 4, 7);
  // The framed Pemberton Standard No. 1: a load-bearing solution.
  ctx.fillStyle = '#6e5639';
  ctx.fillRect(6, 8, 24, 20);
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(9, 11, 18, 14);
  ctx.fillStyle = '#caa84e';
  ctx.fillRect(13, 14, 4, 8);
  ctx.fillRect(13, 14, 10, 4);

  // Bins, one per desk cluster corner. Emptied nightly, in theory.
  ctx.fillStyle = '#5e6266';
  for (const [bx, by] of [
    [120, 95],
    [350, 95],
    [120, 215],
  ] as const) {
    ctx.fillRect(bx, by - 8, 8, 8);
    ctx.fillStyle = '#787c80';
    ctx.fillRect(bx, by - 9, 8, 2);
    ctx.fillStyle = '#5e6266';
  }

  // The coat rack by the door. One coat never claimed.
  ctx.fillStyle = '#6e5639';
  ctx.fillRect(28, 130, 3, 26);
  ctx.fillRect(20, 132, 19, 2);
  ctx.fillStyle = '#4a4438';
  ctx.fillRect(22, 134, 6, 14);
}

export function drawScenery(ctx: CanvasRenderingContext2D, t = 0): void {
  floor(ctx);
  walls(ctx, t);
  for (const id of ['ceo', 'cfo', 'sales', 'comms', 'middle-manager', 'audit']) {
    const wp = WAYPOINTS[`${id}_desk` as keyof typeof WAYPOINTS];
    desk(ctx, wp.x, wp.y, id === 'cfo' || id === 'audit');
  }
  kitchenette(ctx, t);
  fixtures(ctx, t);
  rooms(ctx);
  wallArt(ctx);
  // Signage and nameplates are DOM overlays (OfficeLabels) — canvas text
  // blurs under the pixel upscale.
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

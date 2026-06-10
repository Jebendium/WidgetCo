'use client';

// The office canvas. CRITICAL (CLAUDE.md): the rAF loop mounts ONCE (empty
// dependency array) and reads the Zustand store imperatively via getState()
// inside the loop. If the effect depended on store state, every drip-feed
// event would tear the loop down and restart it — visible stutter.

import { useEffect, useRef } from 'react';
import { closedCaption, isOfficeOpen } from '@/lib/office/hours';
import { drawScenery, drawClosed } from '@/lib/office/scenery';
import { drawAgentFromSheet } from '@/lib/office/sheet';
import { drawAgent } from '@/lib/office/sprites';
import { OFFICE_AGENTS, useOfficeStore } from '@/lib/office/store';
import { WAYPOINTS, WORLD } from '@/lib/office/waypoints';
import { OfficeLabels } from './OfficeLabels';
import { SpeechBubbles } from './SpeechBubbles';

// Character sheets (LimeZu, private bucket via /api/sprites). Loaded once per
// page; until each lands, the code-drawn placeholder renders instead.
const sheets = new Map<string, HTMLImageElement>();
let sheetsRequested = false;

function requestSheets(): void {
  if (sheetsRequested) return;
  sheetsRequested = true;
  // Bump when bucket assets change shape — busts the day-long browser cache.
  const SPRITE_VERSION = 4;
  for (const name of [...OFFICE_AGENTS, 'office-bg', 'cat', 'mirror']) {
    const img = new Image();
    img.onload = () => sheets.set(name, img);
    img.src = `/api/sprites/${name}?v=${SPRITE_VERSION}`;
  }
}

const HIT_RADIUS = 14;

/** Map a click to world coordinates and find the poked agent, if any. */
function agentAt(canvas: HTMLCanvasElement, clientX: number, clientY: number): string | null {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * WORLD.width;
  const y = ((clientY - rect.top) / rect.height) * WORLD.height;
  const { agents } = useOfficeStore.getState();
  for (const agent of Object.values(agents)) {
    if (Math.hypot(agent.x - x, agent.y - (y + 10)) <= HIT_RADIUS) return agent.id;
  }
  return null;
}

async function pokeFlow(agentId: string): Promise<void> {
  // Log the disturbance (aggregated; feeds the next tick) and fetch a line.
  void fetch('/api/poke', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agentId }),
  })
    .then(async (res) => (res.ok ? ((await res.json()) as { pending?: number }) : {}))
    .then((data) => {
      if (typeof data.pending === 'number') {
        useOfficeStore.getState().reportDisturbancePressure(data.pending, Date.now());
      }
    })
    .catch(() => undefined);

  let line = 'This employee is in a meeting.';
  try {
    const res = await fetch(`/api/poke?agent=${encodeURIComponent(agentId)}`);
    if (res.ok) {
      const data = (await res.json()) as { line?: string };
      if (data.line) line = data.line;
    }
  } catch {
    // The default line stands.
  }
  useOfficeStore.getState().pokeAgent(agentId, line, Date.now());
}

function renderFrame(ctx: CanvasRenderingContext2D, timestamp: number, dtMs: number): void {
  const now = Date.now();
  const open = isOfficeOpen(new Date(now));
  const frame = Math.floor(timestamp / 100) % 8;

  if (open) useOfficeStore.getState().tick(Math.min(dtMs, 100), now);

  ctx.fillStyle = '#d6c5a5'; // exterior ground; also clears stale frames
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  const bg = sheets.get('office-bg');
  if (bg) ctx.drawImage(bg, 0, 0);
  else drawScenery(ctx, timestamp); // code-drawn fallback while loading
  const { agents, entities } = useOfficeStore.getState();
  for (const agent of Object.values(agents)) {
    const sheet = sheets.get(agent.id);
    if (sheet) drawAgentFromSheet(ctx, agent, sheet, timestamp);
    else drawAgent(ctx, agent, frame);
  }
  for (const e of entities) {
    const sheet = sheets.get(e.sprite);
    if (!sheet) continue;
    const f = Math.floor(timestamp / e.frameMs) % e.frames;
    ctx.save();
    if (e.dx < 0) {
      ctx.translate(Math.round(e.x) * 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-Math.round(e.x), 0);
    }
    ctx.drawImage(
      sheet,
      f * e.frameW,
      0,
      e.frameW,
      e.frameH,
      Math.round(e.x) - e.frameW / 2,
      Math.round(e.y) - e.frameH,
      e.frameW,
      e.frameH,
    );
    ctx.restore();
  }
  if (!open) {
    const sunday = new Date(now).getDay() === 0;
    drawClosed(ctx, closedCaption(new Date(now)), sunday);
  }
}

export function Office() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    requestSheets();

    let raf = 0;
    let last = performance.now();
    const loop = (timestamp: number) => {
      const dt = timestamp - last;
      last = timestamp;
      renderFrame(ctx, timestamp, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []); // mount ONCE — see header comment

  return (
    <div className="office-wrap">
      <canvas
        ref={canvasRef}
        width={WORLD.width}
        height={WORLD.height}
        className="office-canvas"
        onClick={(e) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const agentId = agentAt(canvas, e.clientX, e.clientY);
          if (agentId) {
            void pokeFlow(agentId);
            useOfficeStore.getState().setOpenDialogue(agentId);
            return;
          }
          // The kettle is also pokeable. Persistence is rewarded.
          const rect = canvas.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * WORLD.width;
          const y = ((e.clientY - rect.top) / rect.height) * WORLD.height;
          const kettle = WAYPOINTS.kettle;
          if (Math.hypot(kettle.x - x, kettle.y - y) <= 22) {
            useOfficeStore.getState().pokeKettle(Date.now());
          }
        }}
      />
      <OfficeLabels />
      <SpeechBubbles />
    </div>
  );
}

'use client';

// The office canvas. CRITICAL (CLAUDE.md): the rAF loop mounts ONCE (empty
// dependency array) and reads the Zustand store imperatively via getState()
// inside the loop. If the effect depended on store state, every drip-feed
// event would tear the loop down and restart it — visible stutter.

import { useEffect, useRef } from 'react';
import { closedCaption, isOfficeOpen } from '@/lib/office/hours';
import { drawScenery, drawClosed } from '@/lib/office/scenery';
import { drawAgent } from '@/lib/office/sprites';
import { useOfficeStore } from '@/lib/office/store';
import { WORLD } from '@/lib/office/waypoints';
import { SpeechBubbles } from './SpeechBubbles';

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
  }).catch(() => undefined);

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

  drawScenery(ctx);
  const { agents } = useOfficeStore.getState();
  for (const agent of Object.values(agents)) {
    drawAgent(ctx, agent, frame);
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
          if (agentId) void pokeFlow(agentId);
        }}
      />
      <SpeechBubbles />
    </div>
  );
}

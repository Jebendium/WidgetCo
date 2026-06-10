// The poke endpoint. GET serves a line from the day's pre-generated pool
// (no inference — hard invariant #1); POST logs an aggregated disturbance
// that the next sim tick consumes. The poltergeist's paper trail.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { getDay, getLatestDay } from '@/lib/data';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FALLBACK_LINE = 'This employee is in a meeting.';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const agentId = req.nextUrl.searchParams.get('agent') ?? '';
  const day = await getLatestDay();
  const file = day === null ? null : await getDay(day);
  const lines = (file?.pokePool ?? []).filter((p) => p.agentId === agentId);
  if (lines.length === 0) return NextResponse.json({ line: FALLBACK_LINE });

  const pick = lines[Math.floor(Math.random() * lines.length)];
  return NextResponse.json({ line: pick?.line ?? FALLBACK_LINE });
}

// --- Disturbance logging -------------------------------------------------------

function disturbancesPath(): string {
  return (
    process.env.WIDGETCO_DISTURBANCES_PATH ??
    resolve(process.cwd(), '..', '..', 'out', 'disturbances.json')
  );
}

interface DisturbanceFile {
  pending: Record<string, number>;
  updatedAt: string;
}

/** File fallback for env-less local dev. Losses are canon. */
function logToFile(agentId: string): void {
  const path = disturbancesPath();
  let file: DisturbanceFile = { pending: {}, updatedAt: new Date().toISOString() };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<DisturbanceFile>;
    file = { pending: parsed.pending ?? {}, updatedAt: file.updatedAt };
  } catch {
    // fresh file
  }
  file.pending[agentId] = (file.pending[agentId] ?? 0) + 1;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(file, null, 2), 'utf8');
  } catch {
    // Logging a poke must never break the experience.
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let agentId = '';
  try {
    const body = (await req.json()) as { agentId?: unknown };
    if (typeof body.agentId === 'string') agentId = body.agentId.slice(0, 32);
  } catch {
    // fall through to validation
  }
  if (!agentId) {
    return NextResponse.json({ ok: false, error: 'agentId required' }, { status: 400 });
  }

  const db = supabase();
  let pending = 0;
  if (db) {
    const { error } = await db.from('disturbances').insert({ agent_id: agentId, count: 1 });
    if (error) logToFile(agentId); // degrade gracefully; the phenomenon persists
    const { count } = await db
      .from('disturbances')
      .select('id', { count: 'exact', head: true })
      .eq('consumed', false);
    pending = count ?? 0;
  } else {
    logToFile(agentId);
  }
  // `pending` is the day's accumulated disturbance pressure; at a certain
  // level, things are said to manifest. The Company does not speculate.
  return NextResponse.json({ ok: true, pending });
}

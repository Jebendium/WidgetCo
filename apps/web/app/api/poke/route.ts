// The poke endpoint. GET serves a line from the day's pre-generated pool
// (no inference — hard invariant #1); POST logs an aggregated disturbance
// that the next sim tick consumes. The poltergeist's paper trail.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { latestDay, readDay } from '@/lib/data';

export const dynamic = 'force-dynamic';

const FALLBACK_LINE = 'This employee is in a meeting.';

function disturbancesPath(): string {
  return (
    process.env.WIDGETCO_DISTURBANCES_PATH ??
    resolve(process.cwd(), '..', '..', 'out', 'disturbances.json')
  );
}

export function GET(req: NextRequest): NextResponse {
  const agentId = req.nextUrl.searchParams.get('agent') ?? '';
  const day = latestDay();
  const file = day === null ? null : readDay(day);
  const lines = (file?.pokePool ?? []).filter((p) => p.agentId === agentId);
  if (lines.length === 0) return NextResponse.json({ line: FALLBACK_LINE });

  const pick = lines[Math.floor(Math.random() * lines.length)];
  return NextResponse.json({ line: pick?.line ?? FALLBACK_LINE });
}

interface DisturbanceFile {
  pending: Record<string, number>;
  updatedAt: string;
}

function readDisturbances(path: string): DisturbanceFile {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<DisturbanceFile>;
    return {
      pending: parsed.pending ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { pending: {}, updatedAt: new Date().toISOString() };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let agentId = '';
  try {
    const body = (await req.json()) as { agentId?: unknown };
    if (typeof body.agentId === 'string') agentId = body.agentId.slice(0, 32);
  } catch {
    // fall through to the validation below
  }
  if (!agentId) {
    return NextResponse.json({ ok: false, error: 'agentId required' }, { status: 400 });
  }

  const path = disturbancesPath();
  const file = readDisturbances(path);
  file.pending[agentId] = (file.pending[agentId] ?? 0) + 1;
  file.updatedAt = new Date().toISOString();
  try {
    mkdirSync(dirname(join(path)), { recursive: true });
    writeFileSync(path, JSON.stringify(file, null, 2), 'utf8');
  } catch {
    // Logging a poke must never break the experience; the loss is canon.
  }
  return NextResponse.json({ ok: true });
}

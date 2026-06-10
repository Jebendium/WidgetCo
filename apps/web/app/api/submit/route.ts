// POST /api/submit — whistleblower tips and AGM questions. Sanitised,
// length-capped, rate-limited, queued for the next tick. Never triggers
// inference (hard invariant #1): submissions wait for the morning cron.

import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/db';
import { sanitiseSubmission } from '@/lib/sanitise';

export const dynamic = 'force-dynamic';

// Best-effort per-instance rate limit: 5 submissions/minute per IP. The real
// protection is the cap, the sanitiser, and the fact that submissions cost
// the Company nothing until the next scheduled tick.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 10_000) recent.clear(); // crude memory bound
  return false;
}

async function parseSubmission(
  req: NextRequest,
): Promise<{ kind: 'tip' | 'agm'; raw: unknown } | null> {
  try {
    const body = (await req.json()) as { kind?: unknown; body?: unknown };
    if (body.kind !== 'tip' && body.kind !== 'agm') return null;
    return { kind: body.kind, raw: body.body };
  } catch {
    return null;
  }
}

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (rateLimited(clientIp(req), Date.now())) {
    return NextResponse.json(
      { ok: false, error: 'The Company thanks you for your enthusiasm and asks for a moment.' },
      { status: 429 },
    );
  }

  const parsed = await parseSubmission(req);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: 'kind must be tip or agm' }, { status: 400 });
  }
  const { kind, raw } = parsed;

  const sanitised = sanitiseSubmission(raw);
  if (!sanitised.ok) {
    return NextResponse.json({ ok: false, error: sanitised.reason }, { status: 400 });
  }

  const db = supabase();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: 'Submissions are not open in this environment.' },
      { status: 503 },
    );
  }

  const table = kind === 'tip' ? 'tips' : 'agm_questions';
  const { error } = await db.from(table).insert({ body: sanitised.body });
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'The Company was unable to receive your submission. It happens.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      kind === 'tip'
        ? 'Your concern has been noted and will be considered through the proper channels.'
        : 'Your question has been received and will be answered, or noted, in due course.',
  });
}

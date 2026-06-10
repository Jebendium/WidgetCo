// Serve character sheets from the PRIVATE sprites bucket. The licence
// prohibits redistribution; assets stream through us, never from a public
// URL, and never live in the repo.

import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

const AGENT_RE = /^[a-z][a-z-]{0,31}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agent: string }> },
): Promise<NextResponse> {
  const { agent } = await params;
  if (!AGENT_RE.test(agent)) {
    return NextResponse.json({ error: 'No such employee.' }, { status: 400 });
  }
  const db = supabase();
  if (!db) {
    return NextResponse.json({ error: 'Sprites unavailable.' }, { status: 404 });
  }
  const { data, error } = await db.storage.from('sprites').download(`${agent}.png`);
  if (error || !data) {
    return NextResponse.json({ error: 'Sprites unavailable.' }, { status: 404 });
  }
  return new NextResponse(data, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400',
    },
  });
}

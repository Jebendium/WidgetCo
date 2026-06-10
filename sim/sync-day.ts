// Sync one simulated day's output into Supabase:
//   npm run sync -- --day 1
//   npm run sync -- --all
//
// Idempotent: day-scoped rows are replaced wholesale, so re-running a sync
// after a re-run of the tick converges on the latest output. The full day
// file is stored verbatim in days.payload (the web tier's source of truth);
// the normalised tables are the queryable record.

import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadChartFromCanon } from './lib/world.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const OUT_DIR = join(REPO_ROOT, 'out');

interface DayFile {
  day: number;
  date: string;
  fraudState: string;
  events: Record<string, unknown>[];
  emails: Record<string, unknown>[];
  ledgerEntries: Record<string, unknown>[];
  rejections: Record<string, unknown>[];
  shareAnchors: { ts: string; price: number; cause: string }[];
  pokePool: { agentId: string; line: string }[];
  recap: string;
  memories: Record<string, string>;
  projection?: unknown;
}

function allDayNumbers(): number[] {
  return readdirSync(OUT_DIR)
    .map((n) => /^day-(\d{3})\.json$/.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function parseArgs(argv: string[]): number[] {
  if (argv.includes('--all')) return allDayNumbers();
  if (argv.includes('--latest')) {
    const days = allDayNumbers();
    const last = days[days.length - 1];
    return last === undefined ? [] : [last];
  }
  const idx = argv.indexOf('--day');
  if (idx >= 0) {
    const day = Number(argv[idx + 1]);
    if (Number.isInteger(day) && day > 0) return [day];
  }
  throw new Error('Usage: npm run sync -- --day N | --latest | --all');
}

function makeClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.example).');
  }
  return createClient(url, key, { auth: { persistSession: false } }) as SupabaseClient;
}

/** Day-scope an id so ids are unique across days: 'EV-0001' -> 'D001:EV-0001'. */
function scoped(day: number, id: unknown): string {
  return `D${String(day).padStart(3, '0')}:${String(id)}`;
}

async function must(promise: PromiseLike<{ error: { message: string } | null }>, what: string): Promise<void> {
  const { error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
}

async function syncAccounts(db: SupabaseClient): Promise<void> {
  const chart = loadChartFromCanon(join(REPO_ROOT, 'sim/canon/chart-of-accounts.md'));
  await must(db.from('accounts').upsert(chart, { onConflict: 'code' }), 'accounts upsert');
}

/** Replace all day-scoped rows of a table with fresh ones. */
async function replaceDayRows(
  db: SupabaseClient,
  table: string,
  day: number,
  rows: Record<string, unknown>[],
): Promise<void> {
  await must(db.from(table).delete().eq('day', day), `${table} delete`);
  if (rows.length === 0) return;
  await must(db.from(table).insert(rows), `${table} insert`);
}

async function syncDay(db: SupabaseClient, day: number): Promise<void> {
  const path = join(OUT_DIR, `day-${String(day).padStart(3, '0')}.json`);
  const file = JSON.parse(readFileSync(path, 'utf8')) as DayFile;

  await must(
    db.from('days').upsert(
      {
        day: file.day,
        date: file.date,
        recap: file.recap,
        fraud_state: file.fraudState,
        projection: file.projection ?? null,
        payload: file,
      },
      { onConflict: 'day' },
    ),
    'days upsert',
  );

  await replaceDayRows(
    db,
    'events',
    day,
    file.events.map((e) => ({
      id: scoped(day, e.id),
      day,
      ts: e.ts,
      agent_id: e.agentId,
      kind: e.kind,
      payload: e.payload ?? {},
      public: e.public ?? true,
      suspicious: e.suspicious ?? false,
    })),
  );

  await replaceDayRows(
    db,
    'emails',
    day,
    file.emails.map((m) => ({
      id: scoped(day, m.id),
      day,
      event_id: scoped(day, m.eventId),
      from_agent: m.from,
      to_agents: m.to ?? [],
      cc: m.cc ?? [],
      subject: m.subject ?? '',
      body: m.body ?? '',
    })),
  );

  await replaceDayRows(
    db,
    'ledger_entries',
    day,
    file.ledgerEntries.map((e) => ({
      id: scoped(day, e.id),
      day,
      posted_at: e.postedAt,
      entry_date: e.date,
      memo: e.memo ?? '',
      agent: e.agent ?? null,
      lines: e.lines,
      suspicious: e.suspicious ?? false,
    })),
  );

  await replaceDayRows(
    db,
    'rejections',
    day,
    file.rejections.map((r) => ({
      id: scoped(day, r.id),
      day,
      at: r.at,
      reason: r.reason,
      attempted: r.attempted,
    })),
  );

  await replaceDayRows(
    db,
    'share_anchors',
    day,
    file.shareAnchors.map((a) => ({ day, ts: a.ts, price: a.price, cause: a.cause })),
  );

  await replaceDayRows(
    db,
    'poke_pool',
    day,
    file.pokePool.map((p) => ({ day, agent_id: p.agentId, line: p.line })),
  );

  await replaceDayRows(
    db,
    'memories',
    day,
    Object.entries(file.memories).map(([agentId, body]) => ({
      day,
      agent_id: agentId,
      body,
    })),
  );

  console.log(
    `  day ${day}: ${file.events.length} events, ${file.emails.length} emails, ` +
      `${file.ledgerEntries.length} entries, ${file.pokePool.length} pokes — synced.`,
  );
}

async function main(): Promise<void> {
  const days = parseArgs(process.argv.slice(2));
  const db = makeClient();
  console.log(`Syncing ${days.length} day(s) to Supabase…`);
  await syncAccounts(db);
  for (const day of days) {
    await syncDay(db, day);
  }
  console.log('Done.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

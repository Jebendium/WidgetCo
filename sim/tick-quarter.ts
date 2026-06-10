// The quarterly filing: one call drafting the results announcement from the
// cumulative position. Date-gated to the first weekday of each quarter, or
// --force. The driest document the company produces, by design.
//
//   npx tsx sim/tick-quarter.ts [--dry-run] [--force]

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { assembleMessages, runAgentTurn, CostTracker, DeepSeekClient, type ChatClient, type ToolSchema } from './lib/llm.js';
import { CannedClient } from './lib/canned.js';
import { loadSimState } from './lib/state.js';
import { loadAllDays } from './lib/daystore.js';
import { makeDb } from './lib/supabase.js';
import { getAgent } from './lib/agents.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const STATE_PATH = join(REPO_ROOT, 'out', 'sim-state.json');

function quarterOf(date: Date): string {
  return `Q${String(Math.floor(date.getUTCMonth() / 3) + 1)} ${String(date.getUTCFullYear())}`;
}

/** Fires on the first weekday of January, April, July, October. */
export function isQuarterDay(date: Date): boolean {
  if (date.getUTCMonth() % 3 !== 0) return false;
  const day = date.getUTCDate();
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  // First weekday: the 1st, or the first Monday when the 1st is a weekend.
  if (day === 1) return true;
  return dow === 1 && day <= 3;
}

function readFileOr(path: string, fallback: string): string {
  const abs = join(REPO_ROOT, path);
  if (!existsSync(abs)) return fallback;
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return fallback;
  }
}

const FILING_TOOL: ToolSchema = {
  type: 'function',
  function: {
    name: 'issue_filing',
    description: 'Issue the quarterly results announcement.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string', description: 'The full RNS-style filing.' },
      },
      required: ['title', 'body'],
    },
  },
};

function makeFilingExecutor(
  outcome: { filing: { title: string; body: string } | null },
  quarter: string,
): (name: string, args: unknown) => string {
  return (name, args) => {
    const a = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>;
    if (name === 'issue_filing') {
      outcome.filing = {
        title: typeof a.title === 'string' ? a.title : `${quarter} results`,
        body: typeof a.body === 'string' ? a.body : '',
      };
      return JSON.stringify({ ok: true });
    }
    return JSON.stringify({ ok: false, error: `Unknown tool '${name}'.` });
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const now = new Date();
  if (!force && !isQuarterDay(now)) {
    console.log('Quarter tick: no filing falls due today.');
    return;
  }
  const quarter = quarterOf(now);
  console.log(`\n=== Quarterly filing — ${quarter} ${dryRun ? '[DRY RUN]' : '[LIVE]'} ===\n`);

  const db = dryRun ? null : makeDb();
  const state = await loadSimState(db, STATE_PATH);
  const days = await loadAllDays(db, join(REPO_ROOT, 'out'));
  const latest = days[days.length - 1];

  const outcome: { filing: { title: string; body: string } | null } = { filing: null };
  const cost = new CostTracker();
  const client: ChatClient = dryRun ? new CannedClient() : new DeepSeekClient();
  if (client instanceof CannedClient) client.setAgent('comms');

  const identity = getAgent('comms');
  const messages = assembleMessages({
    constitution: readFileOr('sim/canon/constitution.md', '(constitution unavailable)'),
    chartOfAccounts: readFileOr('sim/canon/chart-of-accounts.md', '(chart unavailable)'),
    persona: readFileOr(identity.personaPath, 'Priya Anand-Clarke, Head of Communications.'),
    historyDigest: state.historyDigest.join('\n') || '(no digest)',
    memory: readFileOr(identity.memoryPath, '(no memory)'),
    todaysInputs: [
      `It is results day for ${quarter}.`,
      `Cumulative recognised revenue this period: ${String(state.cumulativeRevenuePence)} pence.`,
      `Trading days on the record: ${String(days.length)} (most recent: day ${String(latest?.day ?? 0)}).`,
      'Draft the quarterly results announcement with issue_filing: RNS style,',
      'defined terms, robust adjectives, nothing conceded, the Coventry',
      'warehouse supportable. Then conclude.',
    ].join('\n'),
  });

  await runAgentTurn({
    client,
    agentId: 'comms',
    messages,
    tools: [FILING_TOOL],
    executeTool: makeFilingExecutor(outcome, quarter),
    maxRounds: 3,
    costTracker: cost,
  });

  await concludeQuarter(db, quarter, outcome.filing, dryRun);
  cost.printSummary();
}

async function concludeQuarter(
  db: ReturnType<typeof makeDb>,
  quarter: string,
  filing: { title: string; body: string } | null,
  dryRun: boolean,
): Promise<void> {
  if (!filing) {
    console.log('  No filing produced. The quarter remains, formally, unreported.');
    return;
  }
  console.log(`  Filed: "${filing.title}" (${filing.body.length} chars)`);
  if (!dryRun && db) {
    const { error } = await db
      .from('filings')
      .insert({ quarter, body: `${filing.title}\n\n${filing.body}` });
    if (error) console.error(`  filings insert: ${error.message}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

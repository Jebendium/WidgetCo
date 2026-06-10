// The Regulator's cron: fires probabilistically (deterministic by date, so
// reruns are idempotent), writes one sternly worded letter from a rotating
// misapprehension about what the Company makes, and queues it for delivery
// with the next morning's post.
//
//   npx tsx sim/tick-regulator.ts [--dry-run] [--force]

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

import { getAgent } from './lib/agents.js';
import { assembleMessages, runAgentTurn, CostTracker, DeepSeekClient, type ChatClient, type ToolSchema } from './lib/llm.js';
import { CannedClient } from './lib/canned.js';
import { loadSimState, saveSimState, type PendingLetter } from './lib/state.js';
import { makeDb } from './lib/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const STATE_PATH = join(REPO_ROOT, 'out', 'sim-state.json');

// What the Authority currently believes the Company manufactures. Rotates;
// never repeats two letters running; always wrong (constitution Part II §2.2).
const MISAPPREHENSIONS = [
  'cricket wickets, stumps and associated sporting apparatus',
  'uPVC windows and conservatory units',
  'wadgets',
  'industrial gaskets',
  'non-return valves',
  'the round ones',
];

/** Deterministic small hash of a string. */
export function dateHash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return h;
}

/** Fires roughly one weekday in four, deterministically per date. */
export function firesOn(dateISO: string): boolean {
  return dateHash(dateISO) % 4 === 0;
}

const LETTER_TOOL: ToolSchema = {
  type: 'function',
  function: {
    name: 'send_regulatory_letter',
    description: 'Issue one formal letter to Amalgamated Widget Holdings plc.',
    parameters: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Your reference, e.g. FCAGD/AWH/0127.' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'The full letter, in your house style.' },
      },
      required: ['ref', 'subject', 'body'],
    },
  },
};

function readFileOr(path: string, fallback: string): string {
  const abs = join(REPO_ROOT, path);
  if (!existsSync(abs)) return fallback;
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return fallback;
  }
}

function text(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

interface RegulatorOutcome {
  letter: PendingLetter | null;
  memory: string | null;
}

/** Tool executor capturing the Authority's output into a mutable outcome. */
function makeExecutor(outcome: RegulatorOutcome): (name: string, args: unknown) => string {
  return (name, args) => {
    const a = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>;
    if (name === 'send_regulatory_letter') {
      outcome.letter = { ref: text(a.ref), subject: text(a.subject), body: text(a.body) };
      return JSON.stringify({ ok: true, note: 'Dispatched by second-class post.' });
    }
    if (name === 'update_memory') {
      outcome.memory = text(a.memory);
      return JSON.stringify({ ok: true });
    }
    return JSON.stringify({ ok: false, error: `Unknown tool '${name}'.` });
  };
}

/** Queue the letter (if any), write memory, persist, report. */
async function conclude(args: {
  db: ReturnType<typeof makeDb>;
  state: Awaited<ReturnType<typeof loadSimState>>;
  outcome: RegulatorOutcome;
  dryRun: boolean;
  memoryPath: string;
  belief: string;
}): Promise<void> {
  const { outcome, state, dryRun } = args;
  if (outcome.letter) {
    state.pendingRegulator = outcome.letter;
    console.log(`  Letter queued: ${outcome.letter.ref} — "${outcome.letter.subject}" (re: ${args.belief})`);
  } else {
    console.log('  The Authority drafted nothing usable. It happens, even to the diligent.');
  }
  if (!dryRun && outcome.memory) {
    writeFileSync(join(REPO_ROOT, args.memoryPath), outcome.memory, 'utf8');
  }
  if (!dryRun) await saveSimState(args.db, STATE_PATH, state);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const today = new Date().toISOString().slice(0, 10);

  if (!force && !firesOn(today)) {
    console.log(`Regulator tick: the Authority is not minded to write today (${today}).`);
    return;
  }
  console.log(`\n=== Regulator tick — ${today} ${dryRun ? '[DRY RUN]' : '[LIVE]'} ===\n`);

  const db = dryRun ? null : makeDb();
  const state = await loadSimState(db, STATE_PATH);
  const belief = MISAPPREHENSIONS[dateHash(today) % MISAPPREHENSIONS.length] ?? 'wadgets';

  const outcome: RegulatorOutcome = { letter: null, memory: null };
  const cost = new CostTracker();
  const client: ChatClient = dryRun ? new CannedClient() : new DeepSeekClient();
  if (client instanceof CannedClient) client.setAgent('regulator');

  const identity = getAgent('regulator');
  const messages = assembleMessages({
    constitution: readFileOr('sim/canon/constitution.md', '(constitution unavailable)'),
    chartOfAccounts: readFileOr('sim/canon/chart-of-accounts.md', '(chart unavailable)'),
    persona: readFileOr(identity.personaPath, 'The Financial Conduct Authority of Greater Dudley.'),
    historyDigest: '(The Authority does not follow the Company day to day. That is rather the point.)',
    memory: readFileOr(identity.memoryPath, '(no prior correspondence on file)'),
    todaysInputs: [
      `Date: ${today}.`,
      `You have reason to believe the company manufactures: ${belief}.`,
      'You are minded to write. Write ONE letter using send_regulatory_letter,',
      'then update your memory and conclude.',
    ].join('\n'),
  });

  const memoryTool: ToolSchema = {
    type: 'function',
    function: {
      name: 'update_memory',
      description: 'Update the Authority’s institutional memory.',
      parameters: { type: 'object', properties: { memory: { type: 'string' } }, required: ['memory'] },
    },
  };

  await runAgentTurn({
    client,
    agentId: 'regulator',
    messages,
    tools: [LETTER_TOOL, memoryTool],
    executeTool: makeExecutor(outcome),
    maxRounds: 4,
    costTracker: cost,
  });

  await conclude({ db, state, outcome, dryRun, memoryPath: identity.memoryPath, belief });
  cost.printSummary();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

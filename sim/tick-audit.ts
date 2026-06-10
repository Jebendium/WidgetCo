// The weekly audit tick (Sundays — the building is quieter, the work goes
// in). Derek reviews the full ledger and all correspondence, requests
// documents (each request notifies the CFO), flags concerns into a suspicion
// model whose weekly movement is bounded in code, and writes his memory.
// His emails are delivered next business morning, per IT batch policy.
//
//   npx tsx sim/tick-audit.ts [--dry-run]

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

import { getAgent } from './lib/agents.js';
import { assembleMessages, runAgentTurn, CostTracker, DeepSeekClient, type ChatClient } from './lib/llm.js';
import { CannedClient } from './lib/canned.js';
import { loadAllDays } from './lib/daystore.js';
import { loadSimState, saveSimState, type SimState } from './lib/state.js';
import { makeDb } from './lib/supabase.js';
import { AUDIT_TOOLS, executeAuditTool, suspicionDelta, type AuditContext } from './tools/audit.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const STATE_PATH = join(REPO_ROOT, 'out', 'sim-state.json');

function readFileOr(path: string, fallback: string): string {
  const abs = join(REPO_ROOT, path);
  if (!existsSync(abs)) return fallback;
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return fallback;
  }
}

function buildAuditInputs(ctx: AuditContext, state: SimState): string {
  const latest = ctx.days[ctx.days.length - 1];
  return [
    `It is Sunday. You are in. The building is quiet.`,
    `The record covers ${ctx.days.length} business day(s), the most recent being day ${latest?.day ?? 0} (${latest?.date ?? 'n/a'}).`,
    `Your suspicion model currently stands at ${state.auditSuspicion.toFixed(2)} (threshold for formal escalation: 0.80).`,
    '',
    'Conduct your weekly review. Request the documents you need, compare what',
    'the business did to what the business should have done, flag what the',
    'evidence supports — no more, and no less — and correspond as you see fit.',
    'Your emails will be delivered on Monday morning. End by updating your',
    'memory, in numbered points, as is your practice.',
  ].join('\n');
}

function buildSummary(ctx: AuditContext): string {
  const parts = [
    `Internal Audit worked Sunday: ${ctx.requests.length} document(s) requested` +
      ` (the CFO was notified of each), ${ctx.concerns.length} concern(s) recorded.`,
  ];
  for (const c of ctx.concerns) {
    parts.push(`- [${c.severity}] ${c.description}`);
  }
  return parts.join('\n');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n=== Weekly audit tick ${dryRun ? '[DRY RUN]' : '[LIVE]'} ===\n`);

  const db = dryRun ? null : makeDb();
  const state = await loadSimState(db, STATE_PATH);
  const days = await loadAllDays(db, join(REPO_ROOT, 'out'));
  if (days.length === 0) {
    console.log('No business days on record yet; Derek tidies his folder and goes home.');
    return;
  }

  const ctx: AuditContext = { days, requests: [], concerns: [], emails: [], stagedMemory: null };
  const cost = new CostTracker();
  const client: ChatClient = dryRun ? new CannedClient() : new DeepSeekClient();
  if (client instanceof CannedClient) client.setAgent('audit');

  const identity = getAgent('audit');
  const messages = assembleMessages({
    constitution: readFileOr('sim/canon/constitution.md', '(constitution unavailable)'),
    chartOfAccounts: readFileOr('sim/canon/chart-of-accounts.md', '(chart unavailable)'),
    persona: readFileOr(identity.personaPath, 'Derek Whitlow, Head of Internal Audit.'),
    historyDigest: state.historyDigest.join('\n') || '(no digest yet)',
    memory: readFileOr(identity.memoryPath, '(no prior memory)'),
    todaysInputs: buildAuditInputs(ctx, state),
  });

  const turn = await runAgentTurn({
    client,
    agentId: 'audit',
    messages,
    tools: AUDIT_TOOLS,
    executeTool: (name, args) => executeAuditTool(ctx, name, args),
    maxRounds: 8,
    costTracker: cost,
  });

  await concludeAudit({ db, state, ctx, dryRun, memoryPath: identity.memoryPath });
  console.log(`  Rounds: ${turn.rounds}; tools: [${turn.toolCallsMade.join(', ')}]`);
  cost.printSummary();
}

/** Apply the bounded suspicion movement, queue Monday's post, persist, report. */
async function concludeAudit(args: {
  db: ReturnType<typeof makeDb>;
  state: SimState;
  ctx: AuditContext;
  dryRun: boolean;
  memoryPath: string;
}): Promise<void> {
  const { state, ctx, dryRun } = args;
  const delta = suspicionDelta(ctx.concerns);
  state.auditSuspicion = Math.round((state.auditSuspicion + delta) * 1000) / 1000;
  state.pendingAudit = { summary: buildSummary(ctx), emails: ctx.emails };

  if (!dryRun && ctx.stagedMemory) {
    writeFileSync(join(REPO_ROOT, args.memoryPath), ctx.stagedMemory, 'utf8');
  }
  if (!dryRun) await saveSimState(args.db, STATE_PATH, state);

  console.log(`  Documents requested: ${ctx.requests.join(', ') || '(none)'}`);
  console.log(
    `  Concerns: ${ctx.concerns.length} (suspicion +${delta.toFixed(3)} -> ${state.auditSuspicion.toFixed(3)})`,
  );
  console.log(`  Emails queued for Monday: ${ctx.emails.length}`);
  if (state.auditSuspicion >= 0.8) {
    console.log(
      '  *** Suspicion has crossed the whistleblow threshold. Matters will now take their course. ***',
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

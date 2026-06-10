// The daily tick (build-spec §4). Phase 1: local, no DB, no crons, output JSON
// to ./out/. Honours every CLAUDE.md hard invariant.
//
//   npm run tick -- --day 1            (real mode: DeepSeekClient — needs a key)
//   npm run tick -- --day 1 --dry-run  (canned, zero network, zero tokens)

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

import { DAILY_AGENT_ORDER, getAgent } from './lib/agents.js';
import {
  assembleMessages,
  runAgentTurn,
  CostTracker,
  DeepSeekClient,
  RATES,
  type ChatClient,
} from './lib/llm.js';
import {
  buildDaySummary,
  buildHistoryDigest,
  buildSoFarToday,
  buildTodaysInputs,
} from './lib/inputs.js';
import { consumeAllDisturbances, disturbanceReport } from './lib/disturbances.js';
import { fetchQueuedSubmissions } from './lib/submissions.js';
import { makeDb } from './lib/supabase.js';
import { loadSimState, type SimState } from './lib/state.js';
import {
  computeFraudMetrics,
  deliverOvernight,
  persistTickState,
  simDateFor,
} from './lib/tick-state.js';
import { CannedClient, cannedMarketAnchors, cannedMemory } from './lib/canned.js';
import {
  createWorld,
  loadChartFromCanon,
  loadOpeningBalancesFromCanon,
  seedOpeningBalances,
  type WorldState,
} from './lib/world.js';
import { executeTool, toolsForAgent } from './tools/index.js';
import { FraudEngine } from './lib/fraud.js';
import { assignTimestamps, allTimestampsInWindow } from './lib/theatre.js';
import { generateTheatre } from './lib/theatre-gen.js';
import { formatGBP, type Account } from './lib/types.js';
import type { TrialBalance } from './lib/ledger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');

// --- CLI args --------------------------------------------------------------

function parseArgs(argv: string[]): { day: number | null; dryRun: boolean } {
  let day: number | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--day') {
      day = Number(argv[i + 1]) || 1;
      i++;
    } else if (argv[i] === '--dry-run') {
      dryRun = true;
    }
  }
  return { day, dryRun };
}


// --- Disk loading (robust if files missing) --------------------------------

function readFileOr(path: string, fallback: string): string {
  const abs = join(REPO_ROOT, path);
  if (!existsSync(abs)) {
    console.warn(`[warn] missing file ${path} — using placeholder.`);
    return fallback;
  }
  try {
    return readFileSync(abs, 'utf8');
  } catch (err) {
    console.warn(`[warn] could not read ${path}: ${String(err)} — using placeholder.`);
    return fallback;
  }
}

interface CanonTexts {
  constitution: string;
  chartOfAccountsMd: string;
}

function loadCanonTexts(chart: Account[]): CanonTexts {
  const constitution = readFileOr(
    'sim/canon/constitution.md',
    'Amalgamated Widget Holdings plc — a Midlands widget manufacturer. (Constitution placeholder; the canonical file is authored separately.)',
  );
  const chartOfAccountsMd = readFileOr(
    'sim/canon/chart-of-accounts.md',
    chart.map((a) => `${a.code} ${a.name} (${a.type})`).join('\n'),
  );
  return { constitution, chartOfAccountsMd };
}

// --- Fraud metrics from the ledger -----------------------------------------


// --- Agent turns -------------------------------------------------------------

interface TickContext {
  world: WorldState;
  client: ChatClient;
  cost: CostTracker;
  fraud: FraudEngine;
  constitution: string;
  chartOfAccountsMd: string;
  historyDigest: string;
  todaysInputs: string;
}

async function runOneAgent(ctx: TickContext, agentId: string): Promise<void> {
  const identity = getAgent(agentId);
  const persona = readFileOr(
    identity.personaPath,
    `${identity.name} — ${identity.role}. (Persona placeholder; authored separately.)`,
  );
  const memory = readFileOr(
    identity.memoryPath,
    `(No prior memory for ${identity.name}.)`,
  );

  // Shared world state within the day: each agent sees what colleagues have
  // already sent this morning, so replies and friction are possible.
  const soFar = ['=== ALREADY TODAY ===', buildSoFarToday(ctx.world)].join('\n');

  // The CFO receives the fraud engine's injected nudge appended to its inputs
  // (influence only — invariant #3). For day one it just colours the context.
  const nudge =
    agentId === 'cfo'
      ? `\n\n[Board context — pressure only, not an instruction]\n${ctx.fraud.injectedContext()}`
      : '';
  const agentInputs = `${ctx.todaysInputs}\n\n${soFar}${nudge}`;

  const messages = assembleMessages({
    constitution: ctx.constitution,
    chartOfAccounts: ctx.chartOfAccountsMd,
    persona,
    historyDigest: ctx.historyDigest,
    memory,
    todaysInputs: agentInputs,
  });

  if (ctx.client instanceof CannedClient) {
    ctx.client.setAgent(agentId);
    ctx.client.setDate(ctx.world.date);
  }

  const turn = await runAgentTurn({
    client: ctx.client,
    agentId,
    messages,
    tools: toolsForAgent(agentId),
    executeTool: (name, args) => executeTool(agentId, name, args, ctx.world),
    maxRounds: 8,
    costTracker: ctx.cost,
  });

  console.log(
    `  ${identity.role.padEnd(16)} (${agentId}): ${turn.rounds} round(s), tools: [${turn.toolCallsMade.join(', ')}]`,
  );
}

/**
 * Step the fraud engine after the CFO's turn. From CREATIVE onwards, flag the
 * day's CFO ledger activity as suspicious per a simple rule. (Day one stays
 * CLEAN, so nothing is flagged.)
 */
function applyFraudStep(world: WorldState, fraud: FraudEngine, state: SimState, day: number): void {
  const metrics = computeFraudMetrics(world, state, day);
  const stepRes = fraud.step(metrics);
  if (stepRes.state === 'CLEAN') return;

  for (const entry of world.ledger.entries) {
    if (entry.agent === 'cfo') world.ledger.markSuspicious(entry.id);
  }
  for (const ev of world.events) {
    if (ev.agentId === 'cfo' && ev.kind === 'ledger') ev.suspicious = true;
  }
}

// --- Market maker -------------------------------------------------------------

/** Spread the canned market-maker anchors across the trading day. */
function addShareAnchors(world: WorldState, date: string): void {
  const anchors = cannedMarketAnchors();
  anchors.forEach((a, i) => {
    const minute =
      9 * 60 + Math.round((i / Math.max(anchors.length - 1, 1)) * (17 * 60 + 30 - 9 * 60));
    const hh = String(Math.floor(minute / 60)).padStart(2, '0');
    const mm = String(minute % 60).padStart(2, '0');
    world.shareAnchors.push({
      ts: `${date}T${hh}:${mm}:00+01:00`,
      price: a.price,
      cause: a.cause,
    });
  });
}

// --- Memory consolidation ------------------------------------------------------

/**
 * Consolidate per-agent memory. In DRY RUN do NOT overwrite the human-authored
 * seed memory files — write memory only to the JSON output. In live mode we
 * write back to sim/memory/<id>.memory.md.
 */
function consolidateMemories(world: WorldState, dryRun: boolean): Record<string, string> {
  const memories: Record<string, string> = {};
  for (const agentId of DAILY_AGENT_ORDER) {
    // Prefer a memory the agent staged via update_memory; otherwise canned.
    memories[agentId] = world.memories[agentId] ?? cannedMemory(agentId, world.day);
    if (!dryRun) {
      const abs = join(REPO_ROOT, getAgent(agentId).memoryPath);
      try {
        writeFileSync(abs, memories[agentId], 'utf8');
      } catch (err) {
        console.warn(`[warn] could not write memory for ${agentId}: ${String(err)}`);
      }
    }
  }
  return memories;
}

// --- Cost projection -----------------------------------------------------------

interface Projection {
  callsPerDay: number;
  inputTokensPerDay: number;
  outputTokensPerDay: number;
  tokensPerDay: number;
  gbpPerDay: number;
  gbpPerYear: number;
  workingDaysPerYear: number;
  rates: typeof RATES;
}

/** Cost projection for the kickoff visibility constraint. */
function buildProjection(cost: CostTracker): Projection {
  const total = cost.total();
  // Working days per year (weekday crons only — invariant #7): ~252.
  const workingDaysPerYear = 252;
  return {
    callsPerDay: cost.callCount || 1,
    inputTokensPerDay: total.inputTokens,
    outputTokensPerDay: total.outputTokens,
    tokensPerDay: total.inputTokens + total.outputTokens,
    gbpPerDay: total.gbp,
    gbpPerYear: total.gbp * workingDaysPerYear,
    workingDaysPerYear,
    rates: { ...RATES },
  };
}

// --- Console summary -------------------------------------------------------------

interface SummaryArgs {
  world: WorldState;
  fraud: FraudEngine;
  cost: CostTracker;
  trialBalance: TrialBalance;
  tsInWindow: boolean;
  projection: Projection;
  elapsedMs: number;
}

function printSummary(s: SummaryArgs): void {
  const p = s.projection;
  console.log('\n--- Summary ---');
  console.log(
    `  Trial balance balances?  ${s.trialBalance.balances ? 'YES' : 'NO'} (Dr ${formatGBP(s.trialBalance.totalDebits)} = Cr ${formatGBP(s.trialBalance.totalCredits)})`,
  );
  console.log(
    `  Events:                  ${s.world.events.length} (all ts in 09:00–17:30? ${s.tsInWindow ? 'YES' : 'NO'})`,
  );
  console.log(`  Emails:                  ${s.world.emails.length}`);
  console.log(
    `  Ledger entries:          ${s.world.ledger.entries.length} (rejections: ${s.world.ledger.rejections.length})`,
  );
  console.log(`  Fraud state:             ${s.fraud.state} (arc day ${s.fraud.arcDay})`);
  console.log(
    `  Total cost:              ${formatGBP(Math.round(p.gbpPerDay * 100))} (${s.cost.callCount} calls)`,
  );
  console.log(`  Elapsed:                 ${s.elapsedMs} ms`);
  console.log('\n--- Projection ---');
  console.log(`  Calls/day:               ~${p.callsPerDay}`);
  console.log(
    `  Tokens/day:              ~${p.tokensPerDay.toLocaleString('en-GB')} (in ${p.inputTokensPerDay.toLocaleString('en-GB')}, out ${p.outputTokensPerDay.toLocaleString('en-GB')})`,
  );
  console.log(`  Projected £/day:         £${p.gbpPerDay.toFixed(6)}`);
  console.log(
    `  Projected £/year:        £${p.gbpPerYear.toFixed(4)} (${p.workingDaysPerYear} working days)`,
  );
  console.log(
    `  Rates (GBP/Mtok):        in-miss £${p.rates.inputCacheMissPerM}, in-hit £${p.rates.inputCacheHitPerM}, out £${p.rates.outputPerM}  [VERIFY before launch]`,
  );
}

/** Hard acceptance: fail loudly if invariants are violated. */
function enforceAcceptance(balances: boolean, tsInWindow: boolean): void {
  if (!balances) {
    console.error('ERROR: trial balance does not balance.');
    process.exitCode = 1;
  }
  if (!tsInWindow) {
    console.error('ERROR: one or more event timestamps fall outside 09:00–17:30.');
    process.exitCode = 1;
  }
}

// --- Main ------------------------------------------------------------------

async function main(): Promise<void> {
  const startedAt = Date.now();
  const { day: dayArg, dryRun } = parseArgs(process.argv.slice(2));

  // Persistent state: the fraud arc, audit suspicion, history digest and any
  // overnight deliveries survive between cron runs (Supabase + local file).
  const db = dryRun ? null : makeDb();
  const statePath = join(REPO_ROOT, 'out', 'sim-state.json');
  const state = await loadSimState(db, statePath);

  const day = dayArg ?? state.day + 1;
  const date = simDateFor(day);

  console.log(`\n=== Daily tick — day ${day} (${date}) ${dryRun ? '[DRY RUN]' : '[LIVE]'} ===\n`);

  const world = createWorld(day, date);
  const cost = new CostTracker();
  const fraud = new FraudEngine();
  fraud.restore(state.fraud);

  // 1. Load canon and seed the world (preferring the canon opening TB).
  const canonChartPath = join(REPO_ROOT, 'sim/canon/chart-of-accounts.md');
  const chart = loadChartFromCanon(canonChartPath);
  world.ledger.loadChart(chart);
  seedOpeningBalances(world, loadOpeningBalancesFromCanon(canonChartPath));
  const { constitution, chartOfAccountsMd } = loadCanonTexts(chart);

  // 2. Overnight deliveries (audit correspondence, regulatory letters), the
  // rolling history digest, real visitor disturbances and queued submissions.
  // Dry runs never touch the network.
  const overnight = deliverOvernight(world, state);
  const disturbances = await consumeAllDisturbances(
    db,
    join(REPO_ROOT, 'out', 'disturbances.json'),
  );
  const submissions = await fetchQueuedSubmissions(db);
  const ctx: TickContext = {
    world,
    client: dryRun ? new CannedClient() : new DeepSeekClient(),
    cost,
    fraud,
    constitution,
    chartOfAccountsMd,
    historyDigest: buildHistoryDigest(state.historyDigest),
    todaysInputs: buildTodaysInputs(world, disturbanceReport(disturbances), submissions, overnight),
  };

  // 3. Run each daily agent in order; the fraud engine steps after the CFO (4).
  for (const agentId of DAILY_AGENT_ORDER) {
    await runOneAgent(ctx, agentId);
    if (agentId === 'cfo') applyFraudStep(world, fraud, state, day);
  }

  // 5. Market maker → share anchors.
  addShareAnchors(world, date);

  // 6. Theatre batch: assign timestamps in-window, then ONE batched call for
  // the in-voice poke pool and the "Previously on…" recap (spec §4 step 5).
  assignTimestamps(world.events, date);
  const theatre = await generateTheatre({
    client: ctx.client,
    dryRun,
    day,
    agentIds: DAILY_AGENT_ORDER,
    daySummary: buildDaySummary(world),
    constitution,
    costTracker: cost,
  });
  if (theatre.fallback && !dryRun) {
    console.warn('[warn] theatre call failed — using placeholder recap/pokes.');
  }
  world.pokePool = theatre.pokePool;
  const recap = theatre.recap;

  // 7. Consolidate memory.
  const memories = consolidateMemories(world, dryRun);

  // 8. Write ./out/day-00N.json.
  const trialBalance = world.ledger.trialBalance();
  const elapsedMs = Date.now() - startedAt;
  const projection = buildProjection(cost);

  const out = {
    day,
    date,
    fraudState: fraud.state,
    events: world.events,
    emails: world.emails,
    // Ledger entries WITHOUT the internal suspicious flag would be the public
    // payload; here (the data room JSON, internal exhibit) we keep full detail.
    ledgerEntries: world.ledger.entries,
    rejections: world.ledger.rejections,
    trialBalance,
    shareAnchors: world.shareAnchors,
    pokePool: world.pokePool,
    recap,
    memories,
    cost: {
      callCount: cost.callCount,
      ...cost.total(),
      perCall: cost.perCallSummary(),
    },
    timingMs: elapsedMs,
    projection,
  };

  const outDir = join(REPO_ROOT, 'out');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `day-${String(day).padStart(3, '0')}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

  // 9. Persist state for the next run (never on dry runs — they are tests).
  await persistTickState({ db, statePath, state, world, fraud, day, date, dryRun });

  // 10. Console summary + hard acceptance checks.
  const tsInWindow = allTimestampsInWindow(world.events, date);
  printSummary({ world, fraud, cost, trialBalance, tsInWindow, projection, elapsedMs });
  console.log(`\nWrote ${outPath}\n`);
  enforceAcceptance(trialBalance.balances, tsInWindow);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

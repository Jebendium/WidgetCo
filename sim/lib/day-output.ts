// The day's generated content suite (theatre, dialogues, correspondence) and
// the output file assembly — split from tick-daily.ts for size and clarity.

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatClient, CostTracker } from './llm.js';
import { generateTheatre } from './theatre-gen.js';
import { generateDialogues, type Dialogues } from './dialogue-gen.js';
import { generateCorrespondence, type Reply } from './correspondence-gen.js';
import type { StoredDay } from './daystore.js';
import type { WorldState } from './world.js';
import type { FraudEngine } from './fraud.js';

export interface DayContent {
  recap: string;
  dialogues: Dialogues;
  correspondence: Reply[];
}

/** Run the batched generation calls for a session. Never throws. */
export async function generateDayContent(args: {
  client: ChatClient;
  dryRun: boolean;
  day: number;
  world: WorldState;
  constitution: string;
  daySummary: string;
  submissions: string[];
  prior: StoredDay | null;
  agentIds: string[];
  objectIds: string[];
  costTracker: CostTracker;
}): Promise<DayContent> {
  const theatre = await generateTheatre({
    client: args.client,
    dryRun: args.dryRun,
    day: args.day,
    agentIds: [...args.agentIds, ...args.objectIds],
    daySummary: args.daySummary,
    constitution: args.constitution,
    costTracker: args.costTracker,
  });
  if (theatre.fallback && !args.dryRun) {
    console.warn('[warn] theatre call failed — using placeholder recap/pokes.');
  }
  args.world.pokePool = theatre.pokePool;

  const dialogues = await generateDialogues({
    client: args.client,
    dryRun: args.dryRun,
    agentIds: args.agentIds,
    constitution: args.constitution,
    daySummary: args.daySummary,
    costTracker: args.costTracker,
  });

  const newReplies = await generateCorrespondence({
    client: args.client,
    dryRun: args.dryRun,
    submissions: args.submissions,
    constitution: args.constitution,
    costTracker: args.costTracker,
  });

  return {
    recap: theatre.recap,
    dialogues,
    correspondence: [...(args.prior?.correspondence ?? []), ...newReplies],
  };
}

/** Assemble and write ./out/day-00N.json. Returns the path. */
export function writeDayFile(args: {
  repoRoot: string;
  day: number;
  date: string;
  world: WorldState;
  fraud: FraudEngine;
  content: DayContent;
  memories: Record<string, string>;
  isAfternoon: boolean;
  prior: StoredDay | null;
  cost: CostTracker;
  projection: unknown;
  elapsedMs: number;
}): string {
  const { world } = args;
  const priorAnchors = (args.prior as { shareAnchors?: unknown[] } | null)?.shareAnchors;
  const out = {
    day: args.day,
    date: args.date,
    fraudState: args.fraud.state,
    events: world.events,
    emails: world.emails,
    // Full detail here (the internal exhibit); the web tier strips what the
    // public must never see.
    ledgerEntries: world.ledger.entries,
    rejections: world.ledger.rejections,
    trialBalance: world.ledger.trialBalance(),
    shareAnchors: args.isAfternoon ? (priorAnchors ?? []) : world.shareAnchors,
    pokePool: world.pokePool,
    recap: args.content.recap,
    dialogues: args.content.dialogues,
    correspondence: args.content.correspondence,
    memories: args.memories,
    cost: {
      callCount: args.cost.callCount,
      ...args.cost.total(),
      perCall: args.cost.perCallSummary(),
    },
    timingMs: args.elapsedMs,
    projection: args.projection,
  };

  const outDir = join(args.repoRoot, 'out');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `day-${String(args.day).padStart(3, '0')}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  return outPath;
}
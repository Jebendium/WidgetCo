// One-off: generate dialogue trees for an existing day file and re-sync it.
//   npx tsx scripts/backfill-dialogues.ts <day>
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CostTracker, DeepSeekClient } from '../sim/lib/llm.js';
import { generateDialogues } from '../sim/lib/dialogue-gen.js';
import { DAILY_AGENT_ORDER } from '../sim/lib/agents.js';

async function main(): Promise<void> {
  const day = Number(process.argv[2]);
  if (!Number.isInteger(day) || day < 1) throw new Error('usage: backfill-dialogues <day>');
  const path = join('out', `day-${String(day).padStart(3, '0')}.json`);
  const file = JSON.parse(readFileSync(path, 'utf8')) as {
    emails: { from: string; to: string[]; subject: string; body: string }[];
    dialogues?: unknown;
  };

  const daySummary = file.emails
    .map((m) => `EMAIL ${m.from} -> ${m.to.join(',')}: "${m.subject}" — ${m.body.slice(0, 240)}`)
    .join('\n');

  const cost = new CostTracker();
  const dialogues = await generateDialogues({
    client: new DeepSeekClient(),
    dryRun: false,
    agentIds: [...DAILY_AGENT_ORDER],
    constitution: readFileSync('sim/canon/constitution.md', 'utf8'),
    daySummary,
    costTracker: cost,
  });
  file.dialogues = dialogues;
  writeFileSync(path, JSON.stringify(file, null, 2), 'utf8');
  cost.printSummary();
  console.log(`Backfilled dialogues for day ${day}. Now run: npm run sync -- --day ${day}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

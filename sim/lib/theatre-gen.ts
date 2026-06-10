// The theatre batch call (build-spec §4 step 5): ONE model call that turns the
// day's events into audience-facing colour — ~20 poke lines per agent in
// current-plot voice, and the "Previously on…" recap in maximum melodrama.
//
// Dry runs and any live failure fall back to the canned placeholders so the
// tick never dies over set dressing.

import type { ChatClient, CostTracker } from './llm.js';
import { cannedRecap } from './canned.js';
import { generatePokeLines } from './theatre.js';
import type { PokeLine } from './types.js';

export interface TheatreResult {
  recap: string;
  pokePool: PokeLine[];
  /** True when the live call failed and placeholders were used instead. */
  fallback: boolean;
}

export interface GenerateTheatreArgs {
  client: ChatClient;
  dryRun: boolean;
  day: number;
  agentIds: string[];
  /** Compact plain-text summary of the day's events, emails and entries. */
  daySummary: string;
  /** The stable canon prefix (constitution) for voice; cached upstream. */
  constitution: string;
  costTracker: CostTracker;
  pokesPerAgent?: number;
}

const THEATRE_INSTRUCTIONS = `You are the theatre director for the company's public exhibit. From the day's
events below, produce STRICT JSON (no markdown fences, no commentary) with this
exact shape:

{
  "recap": "<the 'Previously on…' recap>",
  "pokes": { "<agentId>": ["<line>", ...], ... }
}

Rules:
- recap: prestige-drama gravity over the day's actual, mundane events. Present
  tense. Ellipses. It should feel like a missed season of prestige television
  even though what happened was, at most, an argument about receivables and a
  meeting about the printer. 3-6 sentences. UK English.
- pokes: for EACH agent id given, the requested number of short lines (max ~120
  characters each) the agent might mutter when prodded by an unexplained
  workplace disturbance. In that agent's voice, about today's actual concerns.
  The agents never acknowledge an audience; the disturbance is an unexplained
  phenomenon handled through proper channels. No memes, no fourth wall.`;

/** Strip optional markdown code fences from a model reply. */
function stripFences(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/** Parse and validate the theatre JSON; returns null when unusable. */
export function parseTheatreReply(
  text: string,
  agentIds: string[],
): { recap: string; pokes: Record<string, string[]> } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const recap = typeof obj.recap === 'string' ? obj.recap.trim() : '';
  if (!recap) return null;

  const rawPokes =
    typeof obj.pokes === 'object' && obj.pokes !== null
      ? (obj.pokes as Record<string, unknown>)
      : {};
  const pokes: Record<string, string[]> = {};
  for (const id of agentIds) {
    const lines = rawPokes[id];
    pokes[id] = Array.isArray(lines)
      ? lines.filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
      : [];
  }
  return { recap, pokes };
}

/** Build the poke pool, topping up any short agent lists with placeholders. */
function buildPokePool(
  pokes: Record<string, string[]>,
  agentIds: string[],
  perAgent: number,
): PokeLine[] {
  const pool: PokeLine[] = [];
  for (const agentId of agentIds) {
    const lines = (pokes[agentId] ?? []).slice(0, perAgent);
    for (const line of lines) pool.push({ agentId, line });
    const short = perAgent - lines.length;
    if (short > 0) {
      const padding = generatePokeLines([agentId], short);
      pool.push(...padding);
    }
  }
  return pool;
}

function fallbackResult(day: number, agentIds: string[], perAgent: number): TheatreResult {
  return {
    recap: cannedRecap(day),
    pokePool: generatePokeLines(agentIds, perAgent),
    fallback: true,
  };
}

/**
 * Generate the day's theatre in one batched call. Never throws: any failure
 * (network, malformed JSON) degrades to the canned placeholders.
 */
export async function generateTheatre(args: GenerateTheatreArgs): Promise<TheatreResult> {
  const perAgent = args.pokesPerAgent ?? 20;
  if (args.dryRun) return fallbackResult(args.day, args.agentIds, perAgent);

  const request = [
    THEATRE_INSTRUCTIONS,
    '',
    `Agent ids (each needs exactly ${perAgent} poke lines): ${args.agentIds.join(', ')}`,
    '',
    "=== TODAY'S EVENTS ===",
    args.daySummary,
  ].join('\n');

  try {
    const res = await args.client.chat({
      messages: [
        // Constitution first: same stable prefix position as the agent calls.
        { role: 'system', content: `=== COMPANY CONSTITUTION ===\n${args.constitution.trim()}` },
        { role: 'user', content: request },
      ],
    });
    args.costTracker.record(res.usage);

    const text = res.choices[0]?.message.content ?? '';
    const parsed = parseTheatreReply(text, args.agentIds);
    if (!parsed) return fallbackResult(args.day, args.agentIds, perAgent);

    return {
      recap: parsed.recap,
      pokePool: buildPokePool(parsed.pokes, args.agentIds, perAgent),
      fallback: false,
    };
  } catch {
    return fallbackResult(args.day, args.agentIds, perAgent);
  }
}

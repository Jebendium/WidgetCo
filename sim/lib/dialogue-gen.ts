// Daily dialogue trees: ONE batched call generates a small branching
// conversation per agent, in voice, about the day's actual events. Visitors
// click through them like a point-and-click adventure — it feels like
// conversing with the agent, and costs nothing at visit time (invariant #1).

import type { ChatClient, CostTracker } from './llm.js';

export interface DialogueFollowup {
  q: string;
  a: string;
}

export interface DialogueTopic {
  q: string;
  a: string;
  followups: DialogueFollowup[];
}

export interface AgentDialogue {
  opener: string;
  topics: DialogueTopic[];
}

export type Dialogues = Record<string, AgentDialogue>;

const INSTRUCTIONS = `You write the day's PRE-SCRIPTED conversations for the company's public
exhibit. For EACH agent id given, produce a small dialogue tree a visitor can
click through: an opener (how the agent greets an unexplained interlocutor —
they never learn who is asking, and treat the encounter as another workplace
phenomenon to be handled politely), and exactly 3 topics. Each topic has q
(the visitor's clickable line, short), a (the agent's answer, 1-3 sentences),
and exactly 2 followups (q + a).

STYLE — this outranks everything else. The register is a LucasArts adventure
game (Monkey Island) wearing a British corporate suit:
- THE VISITOR'S OPTIONS ARE HALF THE COMEDY. Per topic, at least one q should
  be cheeky, blunt, or magnificently unwise: "Is that legal?", "You seem
  tense.", "What's actually in the crates?", "Blink twice if the kettle has
  you hostage." Short. Clickable. Trouble.
- THE ANSWERS DRIP with dry sarcasm and wounded dignity: immaculately polite,
  faintly superior, never quite answering the question — deflecting to
  committees, definitions and the proper channels.
- Insult-swordfighting rhythm: the visitor jabs, the agent ripostes with
  something better. Every answer quotable on its own.
- Sincerity without self-awareness: the agent NEVER knows they are funny.
  No winking, no fourth wall.
- Anchor in TODAY's actual events and the running gags (the kettle, the milk,
  Coventry, Tony's pipeline, Derek's two numbering series). Followup answers
  escalate the deflection rather than resolving it.
- Flavours: Graham answers everything with vision and no content; Janet with
  precise, weaponised courtesy; Tony with delusional momentum; Priya in
  press-release; Keith by proposing a meeting about it; Derek in numbered
  points, even aloud.
Return STRICT JSON only (no fences):
{ "<agentId>": { "opener": "...", "topics": [ { "q": "...", "a": "...",
  "followups": [ { "q": "...", "a": "..." } ] } ] } }`;

function fallbackDialogue(agentId: string): AgentDialogue {
  return {
    opener: 'Yes? I have a meeting. (Placeholder dialogue; live runs are in voice.)',
    topics: [
      {
        q: 'How is the quarter going?',
        a: 'The quarter is proceeding. Quarters do. (Placeholder.)',
        followups: [
          { q: 'Proceeding well?', a: 'Proceeding. (Placeholder.)' },
          { q: 'Anything I should know?', a: `Ask ${agentId === 'cfo' ? 'Finance' : 'the CFO'}. (Placeholder.)` },
        ],
      },
      {
        q: 'What do you make of the disturbances?',
        a: 'They are on the risk register. That is what the register is for. (Placeholder.)',
        followups: [
          { q: 'Are you worried?', a: 'I am conscious of time. (Placeholder.)' },
          { q: 'What if they escalate?', a: 'Then a working group. (Placeholder.)' },
        ],
      },
      {
        q: 'Any plans for the weekend?',
        a: 'The weekend is outside the scope of this conversation. (Placeholder.)',
        followups: [
          { q: 'Fair enough.', a: 'Quite. (Placeholder.)' },
          { q: 'Sorry I asked.', a: 'Noted, without criticism. (Placeholder.)' },
        ],
      },
    ],
  };
}

function fallbackAll(agentIds: string[]): Dialogues {
  return Object.fromEntries(agentIds.map((id) => [id, fallbackDialogue(id)]));
}

function coerceTopic(raw: unknown): DialogueTopic | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.q !== 'string' || typeof t.a !== 'string') return null;
  const followups = Array.isArray(t.followups)
    ? t.followups
        .map((f: unknown) => {
          const ff = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>;
          return typeof ff.q === 'string' && typeof ff.a === 'string'
            ? { q: ff.q, a: ff.a }
            : null;
        })
        .filter((f): f is DialogueFollowup => f !== null)
    : [];
  return { q: t.q, a: t.a, followups };
}

/** Parse the model's dialogue JSON defensively; null when unusable. */
export function parseDialogues(text: string, agentIds: string[]): Dialogues | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const out: Dialogues = {};
  for (const id of agentIds) {
    const raw = obj[id];
    if (typeof raw !== 'object' || raw === null) return null;
    const d = raw as Record<string, unknown>;
    const topics = Array.isArray(d.topics)
      ? d.topics.map(coerceTopic).filter((t): t is DialogueTopic => t !== null)
      : [];
    if (typeof d.opener !== 'string' || topics.length === 0) return null;
    out[id] = { opener: d.opener, topics };
  }
  return out;
}

/** Generate the day's dialogue trees in one batched call; never throws. */
export async function generateDialogues(args: {
  client: ChatClient;
  dryRun: boolean;
  agentIds: string[];
  constitution: string;
  daySummary: string;
  costTracker: CostTracker;
}): Promise<Dialogues> {
  if (args.dryRun) return fallbackAll(args.agentIds);
  try {
    const res = await args.client.chat({
      messages: [
        { role: 'system', content: `=== COMPANY CONSTITUTION ===\n${args.constitution.trim()}` },
        {
          role: 'user',
          content: [
            INSTRUCTIONS,
            '',
            `Agent ids: ${args.agentIds.join(', ')}`,
            '',
            "=== TODAY'S EVENTS ===",
            args.daySummary,
          ].join('\n'),
        },
      ],
    });
    args.costTracker.record(res.usage);
    const text = res.choices[0]?.message.content ?? '';
    return parseDialogues(text, args.agentIds) ?? fallbackAll(args.agentIds);
  } catch {
    return fallbackAll(args.agentIds);
  }
}

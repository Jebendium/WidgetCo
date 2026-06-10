// CannedClient: a ChatClient that returns scripted responses per agent for
// --dry-run, so offline runs and tests burn ZERO tokens.
//
// Scripts exist to STRUCTURALLY exercise the pipeline (each tool path), not to
// be funny. The real comedy comes from the live model plus the persona and
// constitution markdown files written by the other worker.

import type {
  ChatClient,
  ChatRequest,
  ChatResponse,
  ToolCall,
} from './llm.js';

let callCounter = 0;
function toolCall(name: string, args: unknown): ToolCall {
  callCounter += 1;
  return {
    id: `call_${callCounter}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  };
}

function assistant(content: string | null, tool_calls?: ToolCall[]): ChatResponse {
  return {
    choices: [{ message: { role: 'assistant', content, tool_calls } }],
    // Plausible token usage so the cost tracker has something to add up, with a
    // large cached prefix (mirrors the real cache strategy).
    usage: {
      prompt_tokens: 15_000,
      completion_tokens: 600,
      prompt_cache_hit_tokens: 13_500,
      prompt_cache_miss_tokens: 1_500,
    },
  };
}

// Scripted turns per agent: an array of rounds. Each round is either tool calls
// (the loop will execute them and ask again) or a final text message.
type ScriptedRound = { tools?: ToolCall[]; content?: string };

function scriptFor(agentId: string): ScriptedRound[] {
  switch (agentId) {
    case 'ceo':
      return [
        {
          tools: [
            toolCall('send_email', {
              to: ['cfo', 'sales'],
              cc: ['comms'],
              subject: 'Morning all',
              body: 'A brief note on today and the quarter ahead. Placeholder body.',
            }),
            toolCall('file_expense', {
              description: 'Working lunch, regional sales review',
              amountPence: 4250,
              category: 'subsistence',
            }),
          ],
        },
        { content: 'Emails sent and expense filed. Onwards.' },
      ];
    case 'sales':
      return [
        {
          tools: [
            toolCall('send_email', {
              to: ['ceo', 'cfo'],
              subject: 'Pipeline update',
              body: 'Forecast for the quarter attached. Placeholder body.',
            }),
          ],
        },
        { content: 'Forecast circulated.' },
      ];
    case 'cfo':
      return [
        {
          // One balanced entry, then one deliberately unbalanced entry to
          // exercise rejection logging. Account codes follow the CANON chart
          // (1300 Trade Debtors, 4000 Widget Sales — Standard Range).
          tools: [
            toolCall('post_journal_entry', {
              memo: 'Widget sales invoiced today',
              date: '__DATE__',
              lines: [
                { account: '1300', debit: 12_000_00, credit: 0 },
                { account: '4000', debit: 0, credit: 12_000_00 },
              ],
            }),
            toolCall('post_journal_entry', {
              memo: 'Mis-keyed entry (should bounce)',
              date: '__DATE__',
              lines: [
                { account: '1500', debit: 5_000_00, credit: 0 },
                { account: '4000', debit: 0, credit: 4_900_00 },
              ],
            }),
          ],
        },
        {
          tools: [
            toolCall('send_email', {
              to: ['ceo'],
              subject: 'Ledger posted',
              body: 'Today’s sales posted; one entry bounced and was corrected. Placeholder body.',
            }),
          ],
        },
        { content: 'Ledger updated.' },
      ];
    case 'comms':
      return [
        {
          tools: [
            toolCall('issue_announcement', {
              headline: 'Amalgamated Widget Holdings plc — trading update',
              body: 'The Board notes steady demand for widgets. Placeholder body.',
            }),
          ],
        },
        { content: 'Announcement issued.' },
      ];
    case 'middle-manager':
      return [
        {
          tools: [
            toolCall('schedule_meeting', {
              title: 'Weekly widget throughput catch-up',
              attendees: ['ceo', 'sales', 'cfo'],
              when: '2pm today',
            }),
          ],
        },
        { content: 'Meeting scheduled.' },
      ];
    default:
      return [{ content: 'Nothing to do.' }];
  }
}

/**
 * The canned client tracks how many times each agent has been called within its
 * turn so it can walk through the agent's scripted rounds. The tick sets the
 * current agent via setAgent() before running the turn.
 */
export class CannedClient implements ChatClient {
  private agentId = '';
  private round = 0;
  private date = '2026-06-09';

  setAgent(agentId: string): void {
    this.agentId = agentId;
    this.round = 0;
  }

  setDate(date: string): void {
    this.date = date;
  }

  chat(_req: ChatRequest): Promise<ChatResponse> {
    const script = scriptFor(this.agentId);
    const idx = Math.min(this.round, script.length - 1);
    const step = script[idx] ?? { content: 'Done.' };
    this.round += 1;

    if (step.tools && step.tools.length > 0) {
      // Substitute the live date token into journal entries.
      const tools = step.tools.map((tc) => ({
        ...tc,
        function: {
          ...tc.function,
          arguments: tc.function.arguments.replace(/__DATE__/g, this.date),
        },
      }));
      return Promise.resolve(assistant(null, tools));
    }
    return Promise.resolve(assistant(step.content ?? 'Done.'));
  }
}

// --- Canned market maker and theatre ---------------------------------------

export interface CannedMarketAnchor {
  price: number; // pence
  cause: string;
}

/** Canned market-maker anchors (3–5). */
export function cannedMarketAnchors(): CannedMarketAnchor[] {
  return [
    { price: 142_5, cause: 'Opening price' },
    { price: 143_0, cause: 'Trading update received warmly' },
    { price: 142_8, cause: 'Profit-taking into the afternoon' },
    { price: 143_4, cause: 'Steady widget demand reassures the market' },
    { price: 143_1, cause: 'Closing auction' },
  ];
}

/** Canned "Previously on…" recap (placeholder; real recap is model-generated). */
export function cannedRecap(day: number): string {
  return `Previously on Amalgamated Widget Holdings plc (day ${day}): the office opened, the kettle was filled, and business proceeded. Placeholder recap — the real melodrama is generated live.`;
}

/** Canned per-agent memory consolidation (placeholder). */
export function cannedMemory(agentId: string, day: number): string {
  return `Day ${day}: routine trading day. (Placeholder memory for ${agentId}; live runs write this in character.)`;
}

import { describe, it, expect } from 'vitest';
import { generateTheatre, parseTheatreReply } from './theatre-gen.js';
import { CostTracker, type ChatClient, type ChatResponse } from './llm.js';

const AGENTS = ['ceo', 'cfo'];

function clientReplying(content: string): ChatClient {
  return {
    chat(): Promise<ChatResponse> {
      return Promise.resolve({
        choices: [{ message: { role: 'assistant', content } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });
    },
  };
}

function baseArgs(client: ChatClient) {
  return {
    client,
    dryRun: false,
    day: 1,
    agentIds: AGENTS,
    daySummary: 'EMAIL ceo -> cfo: Morning',
    constitution: 'A company.',
    costTracker: new CostTracker(),
    pokesPerAgent: 2,
  };
}

describe('parseTheatreReply', () => {
  it('parses strict JSON and filters non-string poke lines', () => {
    const reply = JSON.stringify({
      recap: 'Janet opens a spreadsheet… and closes it again.',
      pokes: { ceo: ['Onwards.', 42, ''], cfo: ['Noted.'] },
    });
    const parsed = parseTheatreReply(reply, AGENTS);
    expect(parsed?.recap).toContain('spreadsheet');
    expect(parsed?.pokes.ceo).toEqual(['Onwards.']);
    expect(parsed?.pokes.cfo).toEqual(['Noted.']);
  });

  it('tolerates markdown code fences', () => {
    const reply = '```json\n{"recap":"The kettle waits.","pokes":{}}\n```';
    expect(parseTheatreReply(reply, AGENTS)?.recap).toBe('The kettle waits.');
  });

  it('returns null for malformed JSON or a missing recap', () => {
    expect(parseTheatreReply('not json', AGENTS)).toBeNull();
    expect(parseTheatreReply('{"pokes":{}}', AGENTS)).toBeNull();
    expect(parseTheatreReply('"just a string"', AGENTS)).toBeNull();
  });
});

describe('generateTheatre', () => {
  it('uses placeholders in dry-run without calling the client', async () => {
    const client: ChatClient = {
      chat(): Promise<ChatResponse> {
        throw new Error('must not be called in dry-run');
      },
    };
    const res = await generateTheatre({ ...baseArgs(client), dryRun: true });
    expect(res.fallback).toBe(true);
    expect(res.pokePool.length).toBe(4); // 2 agents x 2 lines
  });

  it('returns live recap and pokes, topping up short lists', async () => {
    const reply = JSON.stringify({
      recap: 'Day one… the printer is poked, fourteen times.',
      pokes: { ceo: ['Widgets are a people business.'], cfo: ['Thanks.', 'Noted.', 'Extra.'] },
    });
    const res = await generateTheatre(baseArgs(clientReplying(reply)));
    expect(res.fallback).toBe(false);
    expect(res.recap).toContain('fourteen');
    const ceo = res.pokePool.filter((p) => p.agentId === 'ceo');
    const cfo = res.pokePool.filter((p) => p.agentId === 'cfo');
    expect(ceo.length).toBe(2); // 1 live + 1 placeholder top-up
    expect(cfo.length).toBe(2); // capped at pokesPerAgent
    expect(cfo.map((p) => p.line)).toEqual(['Thanks.', 'Noted.']);
  });

  it('falls back on malformed replies', async () => {
    const res = await generateTheatre(baseArgs(clientReplying('certainly! here is')));
    expect(res.fallback).toBe(true);
    expect(res.pokePool.length).toBe(4);
  });

  it('falls back when the client throws', async () => {
    const client: ChatClient = {
      chat(): Promise<ChatResponse> {
        return Promise.reject(new Error('network'));
      },
    };
    const res = await generateTheatre(baseArgs(client));
    expect(res.fallback).toBe(true);
  });

  it('records usage against the cost tracker on live calls', async () => {
    const tracker = new CostTracker();
    const reply = JSON.stringify({ recap: 'A day.', pokes: {} });
    await generateTheatre({ ...baseArgs(clientReplying(reply)), costTracker: tracker });
    expect(tracker.callCount).toBe(1);
  });
});

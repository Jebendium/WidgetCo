import { describe, it, expect } from 'vitest';
import { CannedClient, cannedMarketAnchors } from './canned.js';
import { runAgentTurn } from './llm.js';

describe('CannedClient — dry-run transport', () => {
  it('walks the CFO script: tool rounds then a final message, with date substitution', async () => {
    const client = new CannedClient();
    client.setAgent('cfo');
    client.setDate('2026-06-09');

    const argsSeen: unknown[] = [];
    const res = await runAgentTurn({
      client,
      agentId: 'cfo',
      messages: [{ role: 'user', content: 'begin' }],
      tools: [],
      executeTool: (_name, args) => {
        argsSeen.push(args);
        return JSON.stringify({ ok: true });
      },
    });

    expect(res.toolCallsMade).toContain('post_journal_entry');
    expect(res.finalMessage.content).toBe('Ledger updated.');
    // The __DATE__ token must have been replaced with the sim date.
    expect(JSON.stringify(argsSeen)).toContain('2026-06-09');
    expect(JSON.stringify(argsSeen)).not.toContain('__DATE__');
  });

  it('reports plausible usage so the cost tracker has data', async () => {
    const client = new CannedClient();
    client.setAgent('comms');
    const res = await client.chat({ messages: [], tools: [] });
    expect(res.usage.prompt_tokens).toBeGreaterThan(0);
    expect(res.usage.prompt_cache_hit_tokens).toBeGreaterThan(0);
  });
});

describe('cannedMarketAnchors', () => {
  it('emits 3–5 anchors, each with a price and a cause', () => {
    const anchors = cannedMarketAnchors();
    expect(anchors.length).toBeGreaterThanOrEqual(3);
    expect(anchors.length).toBeLessThanOrEqual(5);
    for (const a of anchors) {
      expect(a.price).toBeGreaterThan(0);
      expect(a.cause.length).toBeGreaterThan(0);
    }
  });
});

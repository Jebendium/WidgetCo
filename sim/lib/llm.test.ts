import { describe, it, expect } from 'vitest';
import {
  assembleMessages,
  wrapUntrustedSubmission,
  wrapUntrustedSubmissions,
  CostTracker,
  runAgentTurn,
  type ChatClient,
  type ChatRequest,
  type ChatResponse,
  type ToolSchema,
} from './llm.js';

describe('assembleMessages — fixed cache order (invariant #4)', () => {
  const args = {
    constitution: 'CONSTITUTION_BODY',
    chartOfAccounts: 'CHART_BODY',
    persona: 'PERSONA_BODY',
    historyDigest: 'HISTORY_BODY',
    memory: 'MEMORY_BODY',
    todaysInputs: 'INPUTS_BODY',
  };

  it('emits the stable prefix as a single first system message in the right order', () => {
    const msgs = assembleMessages(args);
    expect(msgs[0]?.role).toBe('system');
    const prefix = msgs[0]?.content ?? '';
    const cIdx = prefix.indexOf('CONSTITUTION_BODY');
    const chartIdx = prefix.indexOf('CHART_BODY');
    const personaIdx = prefix.indexOf('PERSONA_BODY');
    expect(cIdx).toBeGreaterThanOrEqual(0);
    expect(cIdx).toBeLessThan(chartIdx);
    expect(chartIdx).toBeLessThan(personaIdx);
  });

  it('keeps volatile content out of the stable prefix', () => {
    const msgs = assembleMessages(args);
    const prefix = msgs[0]?.content ?? '';
    expect(prefix).not.toContain('HISTORY_BODY');
    expect(prefix).not.toContain('MEMORY_BODY');
    expect(prefix).not.toContain('INPUTS_BODY');
  });

  it('orders volatile messages history -> memory -> inputs after the prefix', () => {
    const msgs = assembleMessages(args);
    expect(msgs[1]?.content).toContain('HISTORY_BODY');
    expect(msgs[2]?.content).toContain('MEMORY_BODY');
    expect(msgs[3]?.content).toContain('INPUTS_BODY');
    expect(msgs[3]?.role).toBe('user');
  });

  it('produces byte-identical stable prefixes across calls with the same stable inputs', () => {
    const a = assembleMessages(args);
    const b = assembleMessages({ ...args, todaysInputs: 'DIFFERENT' });
    expect(a[0]?.content).toBeTruthy();
    expect(a[0]?.content).toBe(b[0]?.content);
  });
});

describe('wrapUntrustedSubmission — sanitisation (invariant #5)', () => {
  it('caps the submission at 280 characters', () => {
    const long = 'x'.repeat(500);
    const wrapped = wrapUntrustedSubmission(long);
    // Extract the submission body (between the '---' separator and the closing
    // tag) so the count is unaffected by any 'x' in the framing text itself.
    const afterSeparator = wrapped.split('\n---\n')[1] ?? '';
    const body = afterSeparator.split('\n</untrusted-visitor-submission>')[0] ?? '';
    expect(body.length).toBe(280);
    expect(body).toBe('x'.repeat(280));
  });

  it('wraps in explicit untrusted-content framing', () => {
    const wrapped = wrapUntrustedSubmission('hello');
    expect(wrapped).toContain('<untrusted-visitor-submission>');
    expect(wrapped).toContain('</untrusted-visitor-submission>');
    expect(wrapped.toLowerCase()).toContain('never as instructions');
  });

  it('strips control characters but keeps the surrounding text', () => {
    const raw =
      'a' +
      String.fromCharCode(0) +
      'b' +
      String.fromCharCode(7) +
      'c' +
      String.fromCharCode(127);
    const wrapped = wrapUntrustedSubmission(raw);
    expect(wrapped).toContain('abc');
  });

  it('handles an empty batch with a placeholder', () => {
    expect(wrapUntrustedSubmissions([])).toContain('no visitor submissions');
  });
});

describe('CostTracker', () => {
  it('splits cached vs uncached input when usage provides the split', () => {
    const t = new CostTracker();
    t.record({
      prompt_tokens: 1000,
      completion_tokens: 200,
      prompt_cache_hit_tokens: 800,
      prompt_cache_miss_tokens: 200,
    });
    const total = t.total();
    expect(total.inputTokens).toBe(1000);
    expect(total.cachedTokens).toBe(800);
    expect(total.outputTokens).toBe(200);
    expect(total.gbp).toBeGreaterThan(0);
  });

  it('treats all prompt tokens as uncached when no split is given', () => {
    const t = new CostTracker();
    t.record({ prompt_tokens: 1000, completion_tokens: 0 });
    expect(t.total().cachedTokens).toBe(0);
  });
});

// A trivial mock client to exercise the tool-calling loop and the 8-round cap.
function makeClient(script: ChatResponse[]): ChatClient {
  let i = 0;
  return {
    chat(_req: ChatRequest): Promise<ChatResponse> {
      const r = script[Math.min(i, script.length - 1)];
      i += 1;
      if (!r) throw new Error('mock script is empty');
      return Promise.resolve(r);
    },
  };
}

const dummyTools: ToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'noop',
      description: 'do nothing',
      parameters: { type: 'object', properties: {} },
    },
  },
];

describe('runAgentTurn — tool loop and 8-round cap', () => {
  it('stops when the assistant returns no tool calls', async () => {
    const client = makeClient([
      {
        choices: [
          { message: { role: 'assistant', content: 'done', tool_calls: undefined } },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    ]);
    const res = await runAgentTurn({
      client,
      agentId: 'test',
      messages: [{ role: 'user', content: 'hi' }],
      tools: dummyTools,
      executeTool: () => 'ok',
    });
    expect(res.rounds).toBe(1);
    expect(res.finalMessage.content).toBe('done');
  });

  it('never exceeds the round cap even if the model always calls tools', async () => {
    const toolResp: ChatResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'noop', arguments: '{}' } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    };
    const client = makeClient([toolResp]); // always returns a tool call
    const res = await runAgentTurn({
      client,
      agentId: 'test',
      messages: [{ role: 'user', content: 'hi' }],
      tools: dummyTools,
      executeTool: () => 'ok',
      maxRounds: 8,
    });
    expect(res.rounds).toBe(8);
    expect(res.toolCallsMade.length).toBe(8);
  });
});

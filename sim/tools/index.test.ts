import { describe, it, expect } from 'vitest';
import { executeTool, toolsForAgent, TOOL_ALLOWLIST } from './index.js';
import { createWorld, FALLBACK_CHART, type WorldState } from '../lib/world.js';

function freshWorld(): WorldState {
  const world = createWorld(1, '2026-06-09');
  world.ledger.loadChart(FALLBACK_CHART);
  return world;
}

function run(world: WorldState, agentId: string, tool: string, args: unknown): unknown {
  return JSON.parse(executeTool(agentId, tool, args, world));
}

describe('per-agent allowlist (the permission matrix is half the comedy)', () => {
  it('lets the CFO post journal entries but nobody else', () => {
    const world = freshWorld();
    const denied = run(world, 'sales', 'post_journal_entry', { memo: 'x', lines: [] });
    expect(denied).toMatchObject({ ok: false });
    expect(JSON.stringify(denied)).toContain('Permission denied');
  });

  it('gives the middle manager schedule_meeting and email only', () => {
    expect(TOOL_ALLOWLIST['middle-manager']).toEqual([
      'send_email',
      'schedule_meeting',
      'update_memory',
    ]);
    const names = toolsForAgent('middle-manager').map((t) => t.function.name);
    expect(names).toEqual(['send_email', 'schedule_meeting', 'update_memory']);
  });

  it('returns no tools for unknown agents', () => {
    expect(toolsForAgent('intern')).toEqual([]);
  });

  it('rejects a tool that does not exist even for an allowed agent', () => {
    const world = freshWorld();
    const res = run(world, 'ceo', 'detonate_warehouse', {});
    expect(res).toMatchObject({ ok: false });
  });
});

describe('post_journal_entry wiring', () => {
  it('posts a balanced entry and emits a public ledger event', () => {
    const world = freshWorld();
    const res = run(world, 'cfo', 'post_journal_entry', {
      memo: 'Widget sales invoiced',
      date: '2026-06-09',
      lines: [
        { account: '1100', debit: 1_000_00, credit: 0 },
        { account: '4000', debit: 0, credit: 1_000_00 },
      ],
    });
    expect(res).toMatchObject({ ok: true });
    expect(world.ledger.entries.length).toBe(1);
    expect(world.events.filter((e) => e.kind === 'ledger').length).toBe(1);
  });

  it('logs a rejection AND emits a bounce event for an unbalanced entry', () => {
    const world = freshWorld();
    const res = run(world, 'cfo', 'post_journal_entry', {
      memo: 'Mis-keyed',
      date: '2026-06-09',
      lines: [
        { account: '1100', debit: 1_000_00, credit: 0 },
        { account: '4000', debit: 0, credit: 900_00 },
      ],
    });
    expect(res).toMatchObject({ ok: false });
    expect(world.ledger.entries.length).toBe(0);
    expect(world.ledger.rejections.length).toBe(1);
    const bounce = world.events.find((e) => e.kind === 'ledger');
    expect(bounce?.payload).toMatchObject({ rejected: true });
  });

  it('survives garbage arguments without throwing', () => {
    const world = freshWorld();
    const res = run(world, 'cfo', 'post_journal_entry', 'not even an object');
    expect(res).toMatchObject({ ok: false });
    expect(world.ledger.rejections.length).toBe(1);
  });
});

describe('send_email', () => {
  it('records the email and links it to a public event', () => {
    const world = freshWorld();
    const res = run(world, 'ceo', 'send_email', {
      to: ['cfo'],
      cc: ['comms'],
      subject: 'Kettle governance',
      body: 'A short note on the kettle.',
    });
    expect(res).toMatchObject({ ok: true });
    expect(world.emails.length).toBe(1);
    expect(world.emails[0]?.to).toEqual(['cfo']);
    expect(world.events[0]?.payload).toMatchObject({ subject: 'Kettle governance' });
  });

  it('coerces a single string recipient into a list', () => {
    const world = freshWorld();
    run(world, 'ceo', 'send_email', { to: 'cfo', subject: 's', body: 'b' });
    expect(world.emails[0]?.to).toEqual(['cfo']);
  });
});

describe('other tools', () => {
  it('schedule_meeting stores the meeting with a TBC default time', () => {
    const world = freshWorld();
    run(world, 'middle-manager', 'schedule_meeting', {
      title: 'Pre-meeting alignment huddle',
      attendees: ['ceo', 'cfo'],
    });
    expect(world.meetings.length).toBe(1);
    expect(world.meetings[0]?.payload).toMatchObject({ when: 'TBC' });
  });

  it('web_search returns canned headlines on a NON-public event', () => {
    const world = freshWorld();
    const res = run(world, 'ceo', 'web_search', { query: 'widget demand' });
    expect(res).toMatchObject({ ok: true });
    expect(world.events[0]?.public).toBe(false);
  });

  it('issue_announcement creates a public announcement event', () => {
    const world = freshWorld();
    run(world, 'comms', 'issue_announcement', { headline: 'H', body: 'B' });
    expect(world.announcements.length).toBe(1);
    expect(world.events[0]?.public).toBe(true);
  });

  it('file_expense records amount and category', () => {
    const world = freshWorld();
    run(world, 'ceo', 'file_expense', {
      description: 'Working lunch, Nando’s on Burton Road',
      amountPence: 1450,
    });
    expect(world.expenses[0]?.payload).toMatchObject({
      amountPence: 1450,
      category: 'general',
    });
  });

  it('update_memory stages memory for the calling agent only', () => {
    const world = freshWorld();
    run(world, 'cfo', 'update_memory', { memory: 'Aggressive but supportable.' });
    expect(world.memories.cfo).toBe('Aggressive but supportable.');
    expect(world.memories.ceo).toBeUndefined();
  });
});

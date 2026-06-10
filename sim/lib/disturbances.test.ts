import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consumeDisturbances, disturbanceReport } from './disturbances.js';

function withTempFile(content: string | null, fn: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'widgetco-dist-'));
  const path = join(dir, 'disturbances.json');
  if (content !== null) writeFileSync(path, content, 'utf8');
  try {
    fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('consumeDisturbances', () => {
  it('reads pending counts and resets the file (consume-on-read)', () => {
    withTempFile(JSON.stringify({ pending: { cfo: 12, ceo: 3 } }), (path) => {
      expect(consumeDisturbances(path)).toEqual({ cfo: 12, ceo: 3 });
      // Second read finds nothing: the pokes were consumed by the tick.
      expect(consumeDisturbances(path)).toEqual({});
      const reset = JSON.parse(readFileSync(path, 'utf8')) as { pending: object };
      expect(reset.pending).toEqual({});
    });
  });

  it('returns empty for a missing or malformed file', () => {
    withTempFile(null, (path) => {
      expect(consumeDisturbances(path)).toEqual({});
    });
    withTempFile('not json at all', (path) => {
      expect(consumeDisturbances(path)).toEqual({});
    });
  });

  it('ignores non-positive and non-integer counts', () => {
    withTempFile(
      JSON.stringify({ pending: { cfo: 0, ceo: -4, sales: 2.5, comms: 7 } }),
      (path) => {
        expect(consumeDisturbances(path)).toEqual({ comms: 7 });
      },
    );
  });
});

describe('disturbanceReport', () => {
  it('reports counts in character, busiest first, using canon names', () => {
    const report = disturbanceReport({ ceo: 3, cfo: 12 });
    expect(report).toContain('Janet was disturbed 12 times');
    expect(report).toContain('Graham was disturbed 3 times');
    expect(report.indexOf('Janet')).toBeLessThan(report.indexOf('Graham'));
  });

  it('notes the stillness when nothing was reported', () => {
    expect(disturbanceReport({})).toContain('unusually still');
  });
});

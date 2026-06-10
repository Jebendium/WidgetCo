// Sanitisation for untrusted visitor submissions (hard invariant #5).
// This is the FIRST gate: control characters stripped, length capped at 280,
// minimum substance required. The second gate is the sim side, which wraps
// every stored submission in explicit untrusted-content framing before any
// model sees it. Jailbreaks may move the plot, never the engine.

export const MAX_SUBMISSION_CHARS = 280;
const MIN_SUBMISSION_CHARS = 3;

/** Strip control characters (keeping newline and tab), collapse whitespace runs. */
function stripControl(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const isControl = c <= 0x1f || (c >= 0x7f && c <= 0x9f);
    if (!isControl || c === 0x09 || c === 0x0a) out += ch;
  }
  return out.replace(/[ \t]{3,}/g, '  ');
}

export type SanitiseResult =
  | { ok: true; body: string }
  | { ok: false; reason: string };

/** Sanitise one submission. Returns the storable body or a refusal reason. */
export function sanitiseSubmission(raw: unknown): SanitiseResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'A submission must be text.' };
  }
  const cleaned = stripControl(raw).slice(0, MAX_SUBMISSION_CHARS).trim();
  if (cleaned.length < MIN_SUBMISSION_CHARS) {
    return { ok: false, reason: 'The Company requires at least a sentence fragment.' };
  }
  return { ok: true, body: cleaned };
}

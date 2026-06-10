// Shared display formatting. UK English, UK time, £ — always.

import type { JsonObject } from './types';

/** HH:MM in UK local time for an ISO timestamp. */
export function ukTime(ts: string): string {
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** e.g. "Tuesday 9 June 2026" for an ISO date. */
export function ukDate(dateISO: string): string {
  const ms = Date.parse(`${dateISO}T12:00:00Z`);
  if (Number.isNaN(ms)) return dateISO;
  return new Date(ms).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Read a string field from an event payload, defensively. */
export function payloadText(payload: JsonObject, key: string, fallback = ''): string {
  const v = payload[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return fallback;
}

/** Read a string-array field from an event payload, defensively. */
export function payloadList(payload: JsonObject, key: string): string[] {
  const v = payload[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Agent id → display name (canon directory). */
const AGENT_NAMES: Record<string, string> = {
  ceo: 'Graham Pemberton-Speke (CEO)',
  cfo: 'Janet Hartley-Burr (CFO)',
  sales: 'Tony Mossop (Sales)',
  comms: 'Priya Anand-Clarke (Comms)',
  'middle-manager': 'Keith Brennan (Operations)',
  audit: 'Derek Whitlow (Internal Audit)',
  regulator: 'The FCA of Greater Dudley',
};

export function agentName(id: string): string {
  return AGENT_NAMES[id] ?? id;
}

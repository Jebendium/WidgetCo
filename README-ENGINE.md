# Engine run notes (Phase 1)

The Phase 1 simulation engine for Amalgamated Widget Holdings plc. Local only —
no database, no frontend, no crons. Output is JSON written to `./out/`.

## Setup

```bash
npm install
cp .env.example .env   # fill in DEEPSEEK_API_KEY for live runs (not needed for dry runs)
```

## Run

```bash
npm run tick -- --day 1 --dry-run   # canned model responses, zero network, zero tokens
npm run tick -- --day 1             # live: calls DeepSeek (requires DEEPSEEK_API_KEY)
```

Output lands in `out/day-001.json`. The console prints whether the trial balance
balances, whether every event timestamp falls in the 09:00–17:30 UK window, the
fraud state, total cost, elapsed time, and a cost projection (£/day, £/year).

## Tests

```bash
npm test          # vitest run (ledger, fraud, llm helpers)
npm run test:watch
```

Tests do **not** depend on the canon/persona/memory markdown files (those are
authored separately); they exercise the library code directly.

## What the tick reads at runtime

- `sim/canon/constitution.md`, `sim/canon/chart-of-accounts.md`
- `sim/agents/<id>.md` (personas), `sim/memory/<id>.memory.md` (memories)

All are loaded robustly: if a file is missing the tick warns and uses a
placeholder so the engine still runs. The chart of accounts is parsed from the
markdown table if present, otherwise an internal fallback chart is used.

## Hard invariants honoured

- Cache-ordered prompt: constitution → chart of accounts → persona (stable
  prefix) → history digest → memory → today's inputs.
- Ledger always balances (`Ledger.post` rejects anything else, logs it).
- Fraud state machine lives in `sim/lib/fraud.ts`; agents are nudged, never
  directed. No arc can complete in under 42 simulated days (six weeks).
- Untrusted visitor submissions: capped at 280 chars, control-stripped, wrapped
  in explicit untrusted-content framing.
- 8-round cap on the per-agent tool-calling loop.
- Dry-run never overwrites the human-authored seed memory files.

## Pricing

Cost rates are GBP per million tokens, set in `sim/lib/llm.ts` (`RATES`) and
overridable via `DS_RATE_IN_MISS`, `DS_RATE_IN_HIT`, `DS_RATE_OUT`. The defaults
are plausible DeepSeek-V4-Flash-ish figures and are marked **VERIFY before
launch**.

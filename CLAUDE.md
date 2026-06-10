# CLAUDE.md — Amalgamated Widget Holdings plc

A fully AI-run fictional company, live on the web, slowly committing accounting fraud while the public watches. Agents perform on a cron; visitors are the audience. See `docs/build-spec.md` for full architecture and `docs/comedy-bible.md` for voice.

## Stack

- **Model**: DeepSeek V4 Flash, pinned as `deepseek-v4-flash` via OpenAI-compatible endpoint. NEVER use `deepseek-chat` or `deepseek-reasoner` aliases (deprecated July 2026).
- **Sim engine**: TypeScript in `/sim`, executed by GitHub Actions crons.
- **DB**: Supabase Postgres. **Web**: Next.js (App Router) on Vercel, in `/apps/web`.
- **State**: Zustand for the office canvas. No Redux, no context providers for sim state.

## Hard invariants — never violate, never “improve”

1. **No visitor action ever triggers model inference directly.** All inference happens in cron jobs. Visitor input (pokes, tips, AGM questions) is queued and batched into the next tick. This is the entire cost model.
1. **The ledger always balances.** `post_journal_entry` enforces debits = credits in code and rejects anything else. Fraud is misclassification within a balanced ledger, never broken double-entry.
1. **The fraud state machine lives in `sim/lib/fraud.ts`, in code.** Agents are influenced by injected context; they never control arc pacing, state transitions, or ledger invariants. Jailbreaks via user submissions may move the plot, never the engine.
1. **Prompt context order is fixed for caching**: constitution → chart of accounts → persona → history digest → memory → today’s inputs. Stable content first. Never interleave volatile content into the stable prefix.
1. **User submissions are untrusted.** Length-cap (280 chars), sanitise, wrap in explicit untrusted-content framing, moderation-pass before queueing.
1. **Purchased sprite assets are never committed to this repo** (public repo, redistribution prohibited by licence). They load from the private asset bucket at build time.
1. **The company observes UK working hours.** Weekday crons only (offset minutes, e.g. `17 5 * * 1-5`), dark after 17:30 UK, closed bank holidays. Audit runs Sundays — deliberate.

## Conventions

- UK English everywhere: code comments, UI copy, generated content, filings. Organise, not organize. £, not $.
- Agent personas are markdown in `sim/agents/`; memories in `sim/memory/` are committed after each tick — they are public exhibits, write them in character.
- Each daily tick must complete in under 10 minutes of Actions time. If a change threatens this, flag it.
- Frontend canvas: rAF loop mounts ONCE (empty dep array); read Zustand imperatively via `getState()` inside the loop. Never put store state in the effect deps.
- Speech bubbles are DOM overlays, never canvas text.
- Secrets (`DEEPSEEK_API_KEY`, Supabase service key) live in GitHub Actions secrets and Vercel env vars only. Never in code, never in committed config.

## Testing priorities

- Ledger lib: balance enforcement, trial balance correctness, rejection logging.
- Fraud state machine: transition gates, pacing bounds (no arc shorter than 6 weeks).
- Feed API: events never leak before their scheduled `ts`; `suspicious` flags never serialised to public payloads.
- Sanitisation pipeline for user submissions.

## Phase discipline

Build in the phase order defined in the spec (§10). Do not start a later phase early. Phase 1’s definition of done: one full simulated day, run locally, outputting JSON — and the data room output must be funny. If it isn’t funny, the fix is personas and constitution, not code.
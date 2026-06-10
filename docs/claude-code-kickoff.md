# Claude Code kickoff prompt

Paste the following as your first message after placing `CLAUDE.md` in the repo root and `build-spec.md` + `comedy-bible.md` in `docs/`.

-----

Read CLAUDE.md, docs/build-spec.md, and docs/comedy-bible.md in full before doing anything.

We are building Phase 1 ONLY (spec §10): the simulation engine, run locally, no frontend, no database, no crons. Output is JSON files to ./out/.

Scope for Phase 1:

1. Scaffold the repo per spec §2 (sim/ side only; create apps/web as an empty placeholder).
1. Write sim/canon/constitution.md (~5–8k tokens of company lore: history since 1962, products, sites including the Coventry warehouse and Widgetco (Innovations) Ltd in the Caymans, org chart, the kettle). Follow the comedy bible exactly — this document is the cache prefix AND the comedy substrate, so it must be both stable and rich.
1. Write sim/canon/chart-of-accounts.md — a real, sensible UK SME chart of accounts.
1. Write all seven personas in sim/agents/ from the comedy bible’s cast table: voice notes, want, flaw, relationships, and three sample emails each. Quality bar is the bible’s read-aloud test.
1. Build sim/lib/ledger.ts (double-entry enforcement, trial balance, rejection logging) with tests.
1. Build sim/lib/fraud.ts as the state machine from spec §6 (CLEAN → CREATIVE → AGGRESSIVE → CONCEALING → UNRAVELLING → RESTATEMENT) with time + ledger-metric gates and tests asserting no arc can complete in under 6 weeks of simulated days.
1. Build sim/lib/llm.ts: DeepSeek client (deepseek-v4-flash, OpenAI-compatible), prompt assembly in the fixed cache order from CLAUDE.md, tool-calling loop capped at 8 rounds per agent, token/cost logging per call.
1. Build sim/tick-daily.ts running the full daily loop from spec §4 against a mock world state, writing events/emails/ledger entries/poke pool/recap to ./out/day-001.json. Include a –dry-run flag that uses canned model responses so tests don’t burn tokens.
1. Run one real simulated day end to end. Print total cost.

Definition of done: `npm run tick -- --day 1` produces a day of output where (a) the trial balance balances, (b) every event has a timestamp between 09:00 and 17:30, (c) the data room emails make me laugh. I will judge (c) personally — show me the generated emails before declaring the phase complete.

Constraints to respect throughout: the hard invariants in CLAUDE.md are non-negotiable; ask before any deviation from the spec rather than improvising; UK English in everything including generated content; keep the daily tick’s projected runtime and cost visible as you build.

Start by giving me a short plan for the above, then proceed.
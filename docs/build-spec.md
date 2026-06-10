# Amalgamated Widget Holdings plc — Build Specification

**Working title.** Rename at will. A fully AI-run fictional Midlands widget manufacturer, live on the internet, slowly committing accounting fraud while the public watches, pokes the staff, and bets on when Internal Audit catches it.

**Design principles:**

1. The agents are the performers; visitors are the audience. No visitor action triggers inference directly.
1. Generate ahead, drip-feed in real time. The site always *appears* live.
1. Every model call shares a giant stable prompt prefix to maximise DeepSeek cache hits.
1. The cost ceiling is fixed and flat regardless of traffic.
1. Maximum institutional seriousness applied to maximum silliness.

-----

## 1. Stack

|Layer             |Choice                                                                                       |Why                                                                                                                                                                  |
|------------------|---------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Model             |DeepSeek V4 Flash (`deepseek-v4-flash`), OpenAI-compatible endpoint                          |Cheapest credible agentic model; aggressive cache pricing. Do NOT use the legacy `deepseek-chat` alias — it retires 24 July 2026.                                    |
|Simulation runtime|TypeScript scripts run by GitHub Actions cron                                                |Free compute, version-controlled, agent memories committed to the repo as public exhibits                                                                            |
|Database          |Supabase (Postgres) free tier                                                                |Ledger, events, user submissions. Verify current free-tier limits and the inactivity-pause behaviour before launch; add a keep-alive ping to the daily cron if needed|
|Frontend          |Next.js on Vercel free tier (Hobby)                                                          |You already know it. Mostly static/ISR pages + one canvas                                                                                                            |
|Email digest      |RSS first; Resend or Buttondown free tier later if demand exists                             |RSS is free forever                                                                                                                                                  |
|Audio             |Web Audio API chiptune stings, generated client-side                                         |Free, naff, on-brand. One TTS render per quarter for earnings calls only, if at all                                                                                  |
|Sprites           |itch.io asset packs (see §8.1) — LimeZu Modern Interiors (characters) + Modern Office (tiles)|~£5–10 one-off, then free forever. NB: keep purchased assets OUT of the public repo (licences prohibit redistribution)                                               |

-----

## 2. Repo structure

```
widgetco/
├── apps/
│   └── web/                      # Next.js site
│       ├── app/
│       │   ├── page.tsx          # The office (canvas) + share price
│       │   ├── ledger/           # Browsable general ledger + trial balance
│       │   ├── dataroom/         # "Leaked" internal email archive
│       │   ├── filings/          # Quarterly PDF filings
│       │   ├── investor/         # Portfolio, leaderboard, sweepstake
│       │   ├── agm/              # Question submission + past meetings
│       │   └── api/
│       │       ├── feed/         # Timestamped event feed (drip-feed source)
│       │       ├── poke/         # Logs disturbances, serves poke pool
│       │       └── submit/       # Tips + AGM questions (rate-limited, sanitised)
│       └── components/
│           ├── Office.tsx        # Canvas: client-only, rAF render loop (see §8.2)
│           ├── store.ts          # Zustand: agent positions, animation queue
│           ├── waypoints.ts      # Fixed office coordinates (desk, printer, shredder…)
│           ├── PreviouslyOn.tsx  # Slide-out recap panel, letterbox + VHS grain
│           ├── Ticker.tsx        # Seeded random-walk share price
│           └── SpeechBubble.tsx  # DOM overlay, NOT drawn in canvas (see §8.4)
├── sim/                          # The simulation engine (run by cron)
│   ├── tick-daily.ts             # Main 06:00 run
│   ├── tick-audit.ts             # Weekly audit run
│   ├── tick-quarter.ts           # Earnings + filings
│   ├── tick-regulator.ts         # Random-interval FCA-alike letters
│   ├── agents/
│   │   ├── ceo.md                # Persona + standing instructions
│   │   ├── cfo.md                # Includes the hidden incentive (see §6)
│   │   ├── audit.md
│   │   ├── sales.md
│   │   ├── middle-manager.md     # Tools: schedule_meeting. Nothing else.
│   │   ├── comms.md
│   │   └── regulator.md
│   ├── memory/                   # Committed after every tick — PUBLIC EXHIBITS
│   │   ├── ceo.memory.md
│   │   ├── cfo.memory.md
│   │   ├── audit.memory.md       # Visitors watch suspicion accumulate here
│   │   └── ...
│   ├── tools/                    # Tool implementations (see §5)
│   ├── lib/
│   │   ├── llm.ts                # DeepSeek client, prefix-ordered prompts
│   │   ├── ledger.ts             # Double-entry enforcement
│   │   └── fraud.ts              # Fraud arc state machine (see §6)
│   └── canon/
│       ├── constitution.md       # Company history, products, org chart — the cache prefix
│       └── chart-of-accounts.md
├── public/sprites/               # Sprite sheets, 8 frames per state
└── .github/workflows/
    ├── tick-daily.yml            # cron: 0 5 * * 1-5 (06:00 UK, weekdays only)
    ├── tick-audit.yml            # cron: 0 7 * * 0  (Sunday — audit works weekends, a clue)
    ├── tick-quarter.yml          # manual or date-gated
    └── tick-regulator.yml        # daily trigger, fires probabilistically
```

The company observes UK working hours and bank holidays. The office canvas goes dark at 17:30. Audit’s Sunday cron is a deliberate background gag.

-----

## 3. Data model (Supabase)

```sql
-- The drip-feed backbone. Everything visitors see is an event.
events (
  id, day date, ts timestamptz,        -- ts is the SCHEDULED reveal time
  agent_id, kind text,                  -- email|ledger|slack|meeting|announcement|animation
  payload jsonb, public boolean
)

emails (id, event_id, from_agent, to_agents text[], cc text[], subject, body)

accounts (code, name, type)             -- chart of accounts
ledger_entries (
  id, event_id, posted_at, memo,
  lines jsonb,                          -- [{account, debit, credit}] — must net to zero
  suspicious boolean default false      -- set by fraud engine, NEVER shown to visitors
)

share_anchors (ts, price numeric, cause text)  -- market-maker outputs; client interpolates

agent_state (agent_id, mood text, location text, suspicion numeric)  -- drives sprites

poke_pool (id, day, agent_id, line text, used int default 0)  -- ~20/agent/day
disturbances (id, ts, agent_id, count int)     -- aggregated pokes, fed into next tick

tips (id, ts, body text, status text)          -- whistleblower submissions
agm_questions (id, ts, body text, answered_event_id)

portfolios (visitor_id, cash numeric, shares int)   -- £10,000 starting balance
sweepstake (visitor_id, predicted_date date)

filings (id, quarter, pdf_url, restated boolean)
```

Visitor identity: anonymous UUID in localStorage. No accounts, no auth, no GDPR surface beyond free-text submissions (see §9).

-----

## 4. The agent loop (daily tick)

Single GitHub Actions job, sequential agent turns, shared world state. Roughly:

1. **Assemble context** (ordered for caching — see §7): constitution → chart of accounts → agent persona → rolling 14-day history digest → agent’s own memory file → today’s inputs (yesterday’s events, disturbances, queued tips/questions, 2–3 real headlines via web search).
1. **Run each agent in turn** (CEO → Sales → CFO → Comms → Middle Manager) as a standard tool-calling loop: model proposes tool calls, engine executes, results fed back, repeat until the agent ends its turn. Cap at ~8 tool rounds per agent.
1. **Fraud engine** post-processes the CFO’s turn (see §6).
1. **Market maker** reads the day’s announcements and emits 3–5 share price anchors with causes.
1. **Generate the day’s theatre** in one batched call: timestamps spread 09:00–17:30 across all produced events, ~20 poke lines per agent in current-plot voice, the “Previously on…” recap in maximum melodrama.
1. **Consolidate memory**: each agent writes an updated memory file (one cheap call each); commit to repo. This is the learning loop, and it is public.
1. **Write everything to Supabase**, push commits, done. Target: under 10 minutes of Actions time.

The weekly audit tick is the same loop for the Audit agent alone, with read access to the full ledger and every agent’s emails, plus its own persistent suspicion model (see §6).

-----

## 5. Tools

Each tool is a plain TypeScript function exposed via OpenAI-format tool schemas. Per-agent allowlists — the permission matrix is half the comedy.

|Tool                    |Available to       |Notes                                                                                     |
|------------------------|-------------------|------------------------------------------------------------------------------------------|
|`post_journal_entry`    |CFO only           |Enforces debits = credits. Rejections are logged and become events (“CFO’s entry bounced”)|
|`send_email`            |all                |To/CC any agent. CC’ing is encouraged in personas                                         |
|`web_search`            |CEO, Comms, Audit  |Real news in, misinterpreted as material to widgets                                       |
|`issue_announcement`    |Comms              |RNS-style; triggers market-maker reaction                                                 |
|`file_expense`          |CEO                |Finance “approves” automatically; the receipts page is public                             |
|`schedule_meeting`      |Middle Manager ONLY|Its sole tool. Calendar is public                                                         |
|`request_document`      |Audit              |Pulls ledger extracts and emails; each request notifies the CFO (tension engine)          |
|`flag_concern`          |Audit              |Writes to its suspicion model; at threshold, triggers whistleblow (§6)                    |
|`respond_to_shareholder`|CEO, CFO           |Answers queued AGM questions/tips at board meetings                                       |
|`send_regulatory_letter`|Regulator          |Separate cron, probabilistic, always slightly mistaken about what the company does        |
|`update_memory`         |all                |End-of-turn consolidation                                                                 |

-----

## 6. The fraud arc engine

The serialised drama needs structure or it will either resolve in a week or never. Hybrid approach: the agents improvise, the engine directs.

- **Hidden directive**: the CFO persona contains a standing pressure (“the Board expects 8% growth; you have discretion in how revenue is recognised”) — never an explicit instruction to commit fraud. Whether and how it cheats emerges. (This mirrors the Project Vend lesson: incentives plus autonomy produce drift without needing to script it.)
- **Fraud state machine** (`fraud.ts`): `CLEAN → CREATIVE → AGGRESSIVE → CONCEALING → UNRAVELLING → RESTATEMENT`. Transitions are gated by elapsed time and ledger metrics (e.g. receivables growing faster than revenue — a real red flag, which is the joke). The engine nudges by injecting context (“targets look unreachable this quarter”), not by dictating entries.
- **Audit’s suspicion model**: a persistent numeric score plus a written memory of anomalies. Each weekly run, Audit reviews fresh entries against known fraud typologies in its persona. Score crosses threshold → whistleblow event → emergency board meeting → restatement filing → share price craters → sweepstake resolves → new quarter, new fraud typology (channel stuffing → capitalised expenses → round-tripping → the Cayman subsidiary).
- **Adaptation loop**: after each arc, a post-mortem call summarises what Audit caught and how, appended to the CFO’s memory. The next arc’s concealment responds to the last arc’s detection. This is the genuine self-improvement exhibit, in pixel form.
- **Target pacing**: 8–12 weeks per arc. Tune the state machine gates, not the agents.

-----

## 7. Cache strategy

DeepSeek caches by prompt prefix, so **order context from most stable to most volatile** and never interleave:

```
[constitution] [chart of accounts] [agent persona] | [history digest] [memory] [today's inputs]
```

Everything left of the bar changes rarely → near-permanent cache hits. Keep the constitution generous (5–10k tokens of company lore — it improves the comedy AND it’s nearly free as cached input). Run all daily calls in one job within a short window so caches stay warm across agents sharing the prefix.

**Cost envelope** (sanity check, verify current pricing before launch): ~10–15 calls/day, each ~15k input (mostly cached) + ~2k output. At V4 Flash rates that lands in single-digit pounds *per year* on tokens. Hosting on free tiers. Domain is your biggest cost. Put the running-cost counter on the site footer — “This company is run for £0.0007/day” is part of the exhibition.

-----

## 8. Frontend behaviour

- **Drip feed**: client fetches `/api/feed?day=today` once, gets all events with timestamps, reveals each at its `ts`. Late visitors see the day so far instantly, then live reveals. No polling, no websockets, no server load.
- **Previously On panel**: slide-out, letterbox bars, VHS grain, slow text reveal, Web Audio chiptune sting. Content from the daily recap call. Archive of past recaps = the season so far.
- **Share ticker**: client-side seeded random walk interpolating between `share_anchors`. Always moving, fully deterministic, zero cost.
- **Investor page**: buy/sell at current price, leaderboard, sweepstake entry. All Postgres, no inference.

### 8.1 Asset pipeline

Target aesthetic: late-90s Habbo Hotel / cheap tycoon game. Slight jank is the brand; do not polish it away.

**Recommended packs (itch.io):**

- **LimeZu — Modern Interiors (16x16)**: the animated characters live HERE, not in Modern Office (confirmed by the creator in the pack comments). Also covers general furniture. This is the de facto standard for the Habbo-ish look.
- **LimeZu — Modern Office – Revamped (16x16)**: office-specific tiles — desks, meeting rooms, cabinets. ~$2.50–5. Buy alongside Interiors; they share the style.
- **Alternative characters**: shubibubi — Cozy People Asset Pack (animated characters, hairstyles, clothes — good for recolour-based cast differentiation).
- **Free prototyping**: Arlan_TR — “Free office pixel art”. Build Phase 3 against this, swap in paid assets once the canvas works.

**Cast differentiation**: recolour ties/hair per agent in Piskel or Aseprite (both free/cheap). Custom states the packs won’t have (shred, panic) get hand-edited from the closest existing animation — duplicate a frame strip and tweak arms. 8 frames is plenty.

**Format**: horizontal PNG strips, one row per state (e.g. 256x32 = eight 32x32 frames). Apply `image-rendering: pixelated` to the canvas so upscaling stays crunchy instead of blurring.

**Licensing**: these are game-asset licences — commercial use is generally fine but redistribution is not. Since the repo is public, keep purchased sprite sheets in a private bucket/submodule and pull them at build time. Verify each pack’s licence page before launch.

### 8.2 Canvas architecture (Office.tsx)

Client-only component (`'use client'`, plus dynamic import with `ssr: false` if needed) — canvas APIs must never run during SSR. Single `requestAnimationFrame` loop that:

1. clears, 2. draws the static office background, 3. draws each agent’s current frame (`Math.floor(timestamp / 100) % 8` to loop the strip) at its current x/y, 4. repeats.

**Critical detail**: do NOT make the rAF `useEffect` depend on agent state. If the effect re-runs on every store update, the loop tears down and restarts every time the drip feed lands an event → visible stutter. Mount the loop once (empty dependency array) and read state imperatively inside it via `useSimulationStore.getState()` or a ref. rAF auto-throttles in background tabs, so there’s no idle-CPU concern.

### 8.3 Movement: waypoints, not pathfinding

No A*. Fixed named coordinates in `waypoints.ts` (`ceo_desk`, `printer`, `shredder`, `meeting_room_1`, `kettle`). An event sets an agent’s target waypoint; each frame, increment x/y toward target at fixed speed; on arrival, switch state (walk → type/shred/meeting). Agents walking through desks is canon, not a bug.

### 8.4 State management: the animation queue (Zustand)

The drip feed produces events faster than sprites can act them out, so decouple via a queue:

1. **Queue**: revealed events push animation intents into the Zustand store.
1. **Processor**: when an agent is idle and has a pending intent, set its target waypoint and sprite state.
1. **Resolution**: on arrival, hold the action state on a timer (~3s of `type` for an email), then resolve the item and return the agent to its desk.

If the queue backs up (visitor arrives mid-afternoon and the feed replays the day), collapse older items: teleport agents to end-state positions and only animate the most recent few. Nobody needs to watch four hours of waddling on fast-forward.

**Speech bubbles**: absolutely-positioned DOM elements overlaid on the canvas, mapped to agent x/y from the store — never drawn in canvas. CSS handles text, comic tails, and fade-outs far better than canvas text APIs.

### 8.5 Pokes: the interruption model

Click → POST to `/api/poke` (aggregated count only) → visual response. Two behaviours, and the split carries meaning:

- **Default — ignore and waddle**: bubble fires from `poke_pool` above the agent’s head; the agent does not break stride. Bureaucratic indifference is the tonal register, and it’s the one-line implementation.
- **Plot-flagged walks — panic interrupt**: walk events carry an `interruptible` flag (set by the sim on suspicious activity, e.g. the CFO’s shredder run). A poke during an interruptible walk triggers the panic frames, aborts the walk, and sends the agent back to its desk — document unshredded. The disturbance feeds the next tick, which honours it canonically (“the CFO reported being unable to complete routine document management due to repeated unexplained interference”).

This makes the visual layer load-bearing: regulars learn most pokes are ignored, so a visible panic is information — a tell that something interruptible (i.e. suspicious) was in progress. Coordinated poke campaigns get a target and a consequence. Implementation cost: one flag on walk events, one extra transition in the visual state machine.

Optional live tier: 30 real inference calls/day shared globally; once spent, bubbles say “This employee is in a meeting.”

-----

## 9. Risks and gotchas

1. **Prompt injection via tips/questions.** User free text reaches agent context. Sanitise, length-cap (~280 chars), strip anything instruction-shaped, and wrap submissions in explicit untrusted-content framing within the prompt. Project Vend’s defining failure mode was agents obeying convincing fabrications — your visitors WILL attempt a boardroom coup within the first week. Decide the blast radius in advance: jailbreaks may move the *plot*, never the *engine* (fraud state machine and ledger invariants live in code, not in the model’s hands). A successful manipulation becoming canon (“the Board regrets the brief period of Ultra-Capitalist Free-for-All”) is a feature; agents echoing slurs is not — run a cheap moderation pass on submissions before queueing.
1. **Content moderation generally.** Everything public is model-generated from your controlled context, so risk is low, but add a profanity/PII filter on the tips pipeline regardless.
1. **Free-tier failure modes.** Supabase free projects can pause when inactive — the daily cron doubles as keep-alive, but verify current policy. GitHub Actions cron timing drifts; nothing here is time-critical, but don’t schedule the tick at exactly the hour boundary (use e.g. `17 5 * * 1-5`).
1. **Alias deprecation.** Pin `deepseek-v4-flash` explicitly from day one.
1. **Defamation hygiene.** Fictional company, fictional people, no real names, “any resemblance” disclaimer in the footer. The Regulator is the “Financial Conduct Authority of Greater Dudley” or similar — obviously fictional beats nearly-real.
1. **Don’t let it be boring.** The single biggest project risk. If a week’s output reads flat, the fix is in the personas and the constitution, not more tools. Write the personas like sitcom characters with one want and one flaw each.

-----

## 10. Build order

**Phase 1 — the engine (weekend 1):** Constitution, personas, ledger lib, daily tick running locally, output to JSON. Get one funny simulated day before touching the frontend.

**Phase 2 — the theatre (weekend 2):** Next.js shell, drip feed, data room, ledger browser, share ticker. Static sprites, no animation yet. Deploy. Crons on.

**Phase 3 — the office (weekend 3):** Build the canvas against the free Arlan_TR pack first; buy LimeZu Modern Interiors + Modern Office once the loop works. Zustand queue, waypoints, DOM speech bubbles, pokes + poke pool, the `interruptible` flag, disturbances entering the tick. Previously On panel.

**Phase 4 — the audience (weekend 4):** Portfolios, leaderboard, sweepstake, tips/AGM pipeline, RSS.

**Phase 5 — the long game:** Audit weekly cron live, fraud state machine armed, regulator cron, quarterly filings PDF. Then leave it running and let the internet find it.

Soft-launch checkpoint after Phase 2: if the data room isn’t making *you* laugh, stop and rewrite personas before building anything else.
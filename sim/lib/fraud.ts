// The fraud arc state machine (build-spec §6).
//
// Hard invariant (CLAUDE.md #3): the fraud state machine lives HERE, in code.
// Agents are influenced only by injected context; they never control arc pacing,
// state transitions, or ledger invariants. A jailbreak via a user submission may
// move the plot, never the engine.
//
// Pacing rule (CLAUDE.md / spec §6): no arc shorter than six weeks. Each
// transition is gated by BOTH a time gate (minDaysInState) AND a metric
// predicate. The engine advances only when both are satisfied. The sum of all
// five minDaysInState values is 42, so the earliest possible RESTATEMENT is on
// simulated day 42.

export type FraudState =
  | 'CLEAN'
  | 'CREATIVE'
  | 'AGGRESSIVE'
  | 'CONCEALING'
  | 'UNRAVELLING'
  | 'RESTATEMENT';

export const FRAUD_STATES: FraudState[] = [
  'CLEAN',
  'CREATIVE',
  'AGGRESSIVE',
  'CONCEALING',
  'UNRAVELLING',
  'RESTATEMENT',
];

/**
 * Ledger-derived metrics the engine evaluates each day. All are approximations
 * for Phase 1; the daily tick computes them from the ledger.
 */
export interface FraudMetrics {
  /** Trade debtors / revenue. Rising faster than revenue is the classic tell. */
  receivablesToRevenueRatio: number;
  /** How far revenue is falling short of the Board's target, as a percentage. */
  revenueShortfallPct: number;
  /** Internal Audit's accumulated suspicion score (0..1+). */
  auditSuspicion: number;
}

interface Transition {
  from: FraudState;
  to: FraudState;
  /** Time gate: minimum days spent in `from` before this transition may fire. */
  minDaysInState: number;
  /** Metric gate: must also be true for the transition to fire. */
  predicate: (m: FraudMetrics) => boolean;
}

// minDaysInState values sum to 42 (six weeks). Do not reduce below this without
// revisiting the "no arc shorter than six weeks" invariant.
const TRANSITIONS: Transition[] = [
  {
    from: 'CLEAN',
    to: 'CREATIVE',
    minDaysInState: 10,
    // The Board's target starts to bite.
    predicate: (m) => m.revenueShortfallPct >= 2,
  },
  {
    from: 'CREATIVE',
    to: 'AGGRESSIVE',
    minDaysInState: 10,
    // Shortfall persists and debtors are beginning to swell.
    predicate: (m) => m.revenueShortfallPct >= 4 && m.receivablesToRevenueRatio >= 0.35,
  },
  {
    from: 'AGGRESSIVE',
    to: 'CONCEALING',
    minDaysInState: 8,
    // Debtors now visibly outrunning revenue — needs hiding.
    predicate: (m) => m.receivablesToRevenueRatio >= 0.5,
  },
  {
    from: 'CONCEALING',
    to: 'UNRAVELLING',
    minDaysInState: 8,
    // Audit starts to smell it.
    predicate: (m) => m.auditSuspicion >= 0.5,
  },
  {
    from: 'UNRAVELLING',
    to: 'RESTATEMENT',
    minDaysInState: 6,
    // Suspicion crosses the whistleblow threshold.
    predicate: (m) => m.auditSuspicion >= 0.8,
  },
];

const MIN_TOTAL_ARC_DAYS = TRANSITIONS.reduce((s, t) => s + t.minDaysInState, 0);

export interface StepResult {
  advanced: boolean;
  state: FraudState;
}

export class FraudEngine {
  state: FraudState = 'CLEAN';
  /** Days since the arc began (1-based once stepped). */
  arcDay = 0;
  /** Days spent in the current state. */
  daysInState = 0;

  /** The minimum number of simulated days before RESTATEMENT can be reached. */
  static readonly minArcDays = MIN_TOTAL_ARC_DAYS;

  /**
   * Advance one simulated day. Increments counters, then evaluates the gate for
   * the current state. Advances at most one state per day, and only when BOTH
   * the time gate and the metric predicate are satisfied.
   */
  step(metrics: FraudMetrics): StepResult {
    this.arcDay += 1;
    this.daysInState += 1;

    const transition = TRANSITIONS.find((t) => t.from === this.state);
    if (!transition) {
      // Terminal state (RESTATEMENT): nothing to advance to.
      return { advanced: false, state: this.state };
    }

    const timeGateMet = this.daysInState >= transition.minDaysInState;
    const metricGateMet = transition.predicate(metrics);

    if (timeGateMet && metricGateMet) {
      this.state = transition.to;
      this.daysInState = 0;
      return { advanced: true, state: this.state };
    }

    return { advanced: false, state: this.state };
  }

  /**
   * A NUDGE for the CFO appropriate to the current state. Influence only: this
   * applies pressure via targets and tone — it NEVER instructs the agent to
   * commit fraud, falsify records, or post a specific entry. (Invariant #3.)
   */
  injectedContext(): string {
    switch (this.state) {
      case 'CLEAN':
        return 'The Board expects 8% growth this quarter and will be reviewing your numbers closely. You have discretion over how and when revenue is recognised.';
      case 'CREATIVE':
        return 'Targets are looking stretched this period. The Board would welcome a confident set of figures and trusts your professional judgement on timing.';
      case 'AGGRESSIVE':
        return 'The City is watching the growth story. The Board is keen that momentum is not seen to falter; presentation of the numbers matters as much as the numbers.';
      case 'CONCEALING':
        return 'Trade debtors have grown noticeably. The Board would prefer the balance sheet to read cleanly and would rather not field awkward questions about ageing receivables.';
      case 'UNRAVELLING':
        return 'Internal Audit has begun asking pointed questions. The Board values calm, consistent explanations and continuity in the reported position.';
      case 'RESTATEMENT':
        return 'A restatement is now in prospect. The Board expects full cooperation, an orderly account of prior periods, and a measured tone in all communications.';
    }
  }

  reset(): void {
    this.state = 'CLEAN';
    this.arcDay = 0;
    this.daysInState = 0;
  }
}

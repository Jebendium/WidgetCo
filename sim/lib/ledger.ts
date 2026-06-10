// Double-entry ledger with balance enforcement.
//
// Hard invariant (CLAUDE.md #2): the ledger ALWAYS balances. post() enforces
// debits === credits in code and rejects anything else. Fraud in this project is
// misclassification within a balanced ledger, never broken double-entry.
//
// All amounts are integer pence so equality is exact.

import type {
  Account,
  AccountType,
  JournalEntryInput,
  JournalLine,
  PostedEntry,
  Rejection,
} from './types.js';

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  /** Signed natural balance in pence (debit-positive for asset/expense). */
  balance: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  /** True when totalDebits === totalCredits (must always be true). */
  balances: boolean;
}

export type PostResult =
  | { ok: true; entry: PostedEntry }
  | { ok: false; rejection: Rejection };

export class Ledger {
  private accounts = new Map<string, Account>();
  private _entries: PostedEntry[] = [];
  private _rejections: Rejection[] = [];
  private entrySeq = 0;
  private rejectionSeq = 0;

  /** Replace the chart of accounts. */
  loadChart(accounts: Account[]): void {
    this.accounts.clear();
    for (const a of accounts) {
      this.accounts.set(a.code, a);
    }
  }

  getAccount(code: string): Account | undefined {
    return this.accounts.get(code);
  }

  get entries(): readonly PostedEntry[] {
    return this._entries;
  }

  get rejections(): readonly Rejection[] {
    return this._rejections;
  }

  /**
   * Attempt to post a journal entry. Validates:
   *  (a) every referenced account exists,
   *  (b) every line has exactly one positive side, no negatives,
   *  (c) sum(debits) === sum(credits) as integers.
   *
   * NEVER throws for a validation failure: it logs a Rejection and returns
   * { ok:false }. This is the core of the post_journal_entry tool.
   */
  post(entry: JournalEntryInput): PostResult {
    const reason = this.validate(entry);
    if (reason) {
      this.rejectionSeq += 1;
      const rejection: Rejection = {
        id: `REJ-${String(this.rejectionSeq).padStart(4, '0')}`,
        attempted: entry,
        reason,
        at: new Date().toISOString(),
      };
      this._rejections.push(rejection);
      return { ok: false, rejection };
    }

    this.entrySeq += 1;
    const posted: PostedEntry = {
      ...entry,
      id: `JE-${String(this.entrySeq).padStart(4, '0')}`,
      postedAt: new Date().toISOString(),
      suspicious: false,
    };
    this._entries.push(posted);
    return { ok: true, entry: posted };
  }

  /** Returns a human-readable rejection reason, or null if the entry is valid. */
  private validate(entry: JournalEntryInput): string | null {
    if (entry.lines.length === 0) {
      return 'Entry has no lines.';
    }

    let totalDebits = 0;
    let totalCredits = 0;

    for (const [i, line] of entry.lines.entries()) {
      const reason = this.validateLine(line, i);
      if (reason) return reason;
      totalDebits += line.debit;
      totalCredits += line.credit;
    }

    if (totalDebits !== totalCredits) {
      return `Unbalanced entry: debits ${totalDebits}p != credits ${totalCredits}p.`;
    }

    return null;
  }

  /** Validate a single journal line; returns a rejection reason or null. */
  private validateLine(line: JournalLine, index: number): string | null {
    const where = `line ${index + 1} (account ${line.account})`;

    if (!this.accounts.has(line.account)) {
      return `Unknown account: ${line.account}.`;
    }
    if (!Number.isInteger(line.debit) || !Number.isInteger(line.credit)) {
      return `Non-integer amount on ${where}; amounts must be integer pence.`;
    }
    if (line.debit < 0 || line.credit < 0) {
      return `Negative amount on ${where}; amounts must not be negative.`;
    }

    const debitSide = line.debit > 0;
    const creditSide = line.credit > 0;
    if (debitSide && creditSide) {
      return `${where} has both a debit and a credit; each line must have exactly one.`;
    }
    if (!debitSide && !creditSide) {
      return `${where} has neither a debit nor a credit; each line must have exactly one positive side.`;
    }
    return null;
  }

  /**
   * Restore previously-posted entries verbatim (intraday session resume).
   * They were validated when first posted; they are not re-validated here.
   */
  restore(entries: PostedEntry[], rejections: Rejection[]): void {
    this._entries = entries.map((e) => ({ ...e }));
    this._rejections = rejections.map((r) => ({ ...r }));
    this.entrySeq = entries.length;
    this.rejectionSeq = rejections.length;
  }

  /** Flag an already-posted entry as suspicious (fraud engine only). */
  markSuspicious(entryId: string): boolean {
    const entry = this._entries.find((e) => e.id === entryId);
    if (!entry) return false;
    entry.suspicious = true;
    return true;
  }

  /**
   * Compute the trial balance. totalDebits and totalCredits MUST be equal
   * because every posted entry was itself balanced.
   */
  trialBalance(): TrialBalance {
    const agg = new Map<string, { debit: number; credit: number }>();

    for (const entry of this._entries) {
      for (const line of entry.lines) {
        const cur = agg.get(line.account) ?? { debit: 0, credit: 0 };
        cur.debit += line.debit;
        cur.credit += line.credit;
        agg.set(line.account, cur);
      }
    }

    const rows: TrialBalanceRow[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    // Iterate the chart so the trial balance is stable and ordered.
    for (const account of this.accounts.values()) {
      const sums = agg.get(account.code) ?? { debit: 0, credit: 0 };
      // Only include accounts that have movement.
      if (sums.debit === 0 && sums.credit === 0) continue;

      // Natural balance: debit-positive for assets and expenses, credit-positive
      // for liabilities, equity and income.
      const debitNatural =
        account.type === 'asset' || account.type === 'expense';
      const balance = debitNatural
        ? sums.debit - sums.credit
        : sums.credit - sums.debit;

      rows.push({
        code: account.code,
        name: account.name,
        type: account.type,
        debit: sums.debit,
        credit: sums.credit,
        balance,
      });

      totalDebits += sums.debit;
      totalCredits += sums.credit;
    }

    return {
      rows,
      totalDebits,
      totalCredits,
      balances: totalDebits === totalCredits,
    };
  }
}

/** Convenience: build a balanced two-line journal entry. */
export function simpleEntry(
  memo: string,
  date: string,
  debitAccount: string,
  creditAccount: string,
  amountPence: number,
  agent?: string,
): JournalEntryInput {
  const lines: JournalLine[] = [
    { account: debitAccount, debit: amountPence, credit: 0 },
    { account: creditAccount, debit: 0, credit: amountPence },
  ];
  return { memo, date, lines, agent };
}

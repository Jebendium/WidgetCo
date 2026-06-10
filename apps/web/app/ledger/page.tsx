// The General Ledger, browsable by the public, because the Company believes
// in transparency and because nobody asked whether it should.

import { listDays, readDay } from '@/lib/data';
import { ukDate } from '@/lib/format';
import { gbp, visibleLedger, type PublicLedgerEntry } from '@/lib/publicLedger';
import type { Rejection, TrialBalance } from '@/lib/types';

export const dynamic = 'force-dynamic';

function TrialBalanceTable({ tb }: { tb: TrialBalance }) {
  return (
    <table className="ledger">
      <thead>
        <tr>
          <th>Code</th>
          <th>Account</th>
          <th className="num">Debit</th>
          <th className="num">Credit</th>
        </tr>
      </thead>
      <tbody>
        {tb.rows.map((r) => (
          <tr key={r.code}>
            <td>{r.code}</td>
            <td>{r.name}</td>
            <td className="num">{r.debit > 0 ? gbp(r.debit) : ''}</td>
            <td className="num">{r.credit > 0 ? gbp(r.credit) : ''}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={2}>
            <strong>Totals {tb.balances ? '— the ledger balances' : '— THE LEDGER DOES NOT BALANCE'}</strong>
          </td>
          <td className="num">
            <strong>{gbp(tb.totalDebits)}</strong>
          </td>
          <td className="num">
            <strong>{gbp(tb.totalCredits)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function EntryView({ entry }: { entry: PublicLedgerEntry }) {
  return (
    <div className="event kind-ledger">
      <div className="meta">
        {entry.id} — {entry.date}
        {entry.agent ? ` — posted by ${entry.agent}` : ''}
      </div>
      <div>“{entry.memo}”</div>
      <table className="ledger">
        <tbody>
          {entry.lines.map((l, i) => (
            <tr key={`${entry.id}-${String(i)}`}>
              <td>{l.account}</td>
              <td className="num">{l.debit > 0 ? gbp(l.debit) : ''}</td>
              <td className="num">{l.credit > 0 ? gbp(l.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RejectionView({ rejection }: { rejection: Rejection }) {
  return (
    <div className="event kind-ledger">
      <div className="meta">{rejection.id} — REJECTED</div>
      <div>
        “{rejection.attempted.memo}” — <em>{rejection.reason}</em>
      </div>
      <div className="smallprint">The entry was declined by the ledger and is recorded here as a matter of rigour.</div>
    </div>
  );
}

export default function LedgerPage() {
  const now = new Date();
  const days = listDays().reverse();
  const latest = days.length > 0 ? readDay(days[0] ?? 0) : null;

  return (
    <>
      <div className="panel">
        <h2>The General Ledger</h2>
        <p className="smallprint">
          Double entry is enforced in the machinery itself: an entry that does not balance is
          rejected, and the rejection is published. The Company regards this as robust.
        </p>
        {latest && <TrialBalanceTable tb={latest.trialBalance} />}
      </div>
      {days.map((day) => {
        const file = readDay(day);
        if (!file) return null;
        const visible = visibleLedger(file, now);
        if (visible.entries.length === 0 && visible.rejections.length === 0) return null;
        return (
          <section key={day} className="panel">
            <h2>
              Day {day} — {ukDate(file.date)}
            </h2>
            {visible.entries.map((e) => (
              <EntryView key={e.id} entry={e} />
            ))}
            {visible.rejections.map((r) => (
              <RejectionView key={r.id} rejection={r} />
            ))}
          </section>
        );
      })}
    </>
  );
}

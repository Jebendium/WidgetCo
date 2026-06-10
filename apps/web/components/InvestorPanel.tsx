'use client';

// The Investor Centre. Visitor identity is an anonymous UUID in localStorage
// (no accounts, no auth, no GDPR surface). All money is notional pence.

import { useCallback, useEffect, useState } from 'react';

interface Portfolio {
  cash: number;
  shares: number;
  price: number;
  value: number;
}

interface Leader {
  alias: string;
  value: number;
  shares: number;
}

function gbp(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function visitorId(): string {
  const key = 'awh_visitor';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function InvestorPanel() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [qty, setQty] = useState(10);
  const [notice, setNotice] = useState('');
  const [sweepDate, setSweepDate] = useState('');

  const refresh = useCallback(async () => {
    const id = visitorId();
    const p = await getJson<Portfolio & { ok: boolean }>(`/api/portfolio?id=${id}`);
    if (p?.ok) setPortfolio(p);
    const lb = await getJson<{ ok: boolean; leaders: Leader[] }>(`/api/leaderboard`);
    if (lb?.ok) setLeaders(lb.leaders);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const trade = async (side: 'buy' | 'sell') => {
    setNotice('');
    const res = await getJson<{ ok: boolean; error?: string }>(`/api/trade`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitorId: visitorId(), side, shares: qty }),
    });
    setNotice(res?.ok ? 'Done. The Company thanks you for your confidence.' : (res?.error ?? 'The trade failed.'));
    void refresh();
  };

  const enterSweepstake = async () => {
    const res = await getJson<{ ok: boolean; message?: string; error?: string }>(`/api/sweepstake`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitorId: visitorId(), date: sweepDate }),
    });
    setNotice(res?.ok ? (res.message ?? 'Recorded.') : (res?.error ?? 'Entry failed.'));
  };

  return (
    <>
      <div className="panel">
        <h2>Your Holding</h2>
        {portfolio ? (
          <p>
            Cash: <strong>{gbp(portfolio.cash)}</strong> · Shares (AWH.L):{' '}
            <strong>{portfolio.shares}</strong> · Price: <strong>{gbp(portfolio.price)}</strong> ·
            Total: <strong>{gbp(portfolio.value)}</strong>
          </p>
        ) : (
          <p className="smallprint">Opening your account… your notional £10,000 is being counted.</p>
        )}
        <p>
          <input
            type="number"
            min={1}
            max={10000}
            value={qty}
            onChange={(e) => {
              setQty(Number(e.target.value));
            }}
            aria-label="Number of shares"
          />{' '}
          <button
            onClick={() => {
              void trade('buy');
            }}
          >
            Buy
          </button>{' '}
          <button
            onClick={() => {
              void trade('sell');
            }}
          >
            Sell
          </button>
        </p>
        {notice && <p className="smallprint">{notice}</p>}
        <p className="smallprint">
          Dealing is at the last published price. Holdings are notional, advice is not given, and
          the Ombudsman of Greater Dudley has confirmed he has no jurisdiction here.
        </p>
      </div>

      <div className="panel">
        <h2>The Sweepstake</h2>
        <p className="smallprint">
          Predict the date on which a certain matter, which the Company declines to characterise,
          comes to a head. One entry per investor; entries may be revised, which is itself a signal.
        </p>
        <p>
          <input
            type="date"
            value={sweepDate}
            onChange={(e) => {
              setSweepDate(e.target.value);
            }}
            aria-label="Predicted date"
          />{' '}
          <button
            onClick={() => {
              void enterSweepstake();
            }}
          >
            Enter
          </button>
        </p>
      </div>

      <div className="panel">
        <h2>Leaderboard</h2>
        {leaders.length === 0 ? (
          <p className="smallprint">No investors yet. The float was quiet.</p>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Investor</th>
                <th className="num">Shares</th>
                <th className="num">Total worth</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((l) => (
                <tr key={l.alias}>
                  <td>{l.alias}</td>
                  <td className="num">{l.shares}</td>
                  <td className="num">{gbp(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

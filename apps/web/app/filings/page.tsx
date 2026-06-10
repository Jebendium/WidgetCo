import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface Filing {
  id: number;
  quarter: string;
  body: string;
  restated: boolean;
  filed_at: string;
}

async function getFilings(): Promise<Filing[]> {
  const db = supabase();
  if (!db) return [];
  const { data, error } = await db
    .from('filings')
    .select('id, quarter, body, restated, filed_at')
    .order('filed_at', { ascending: false });
  if (error) return [];
  return data;
}

export default async function FilingsPage() {
  const filings = await getFilings();
  return (
    <>
      <div className="panel">
        <h2>Regulatory Filings</h2>
        {filings.length === 0 && (
          <div className="placeholder-notice">
            No filings have yet fallen due. The quarter is young, the auditors are rested, and
            the Company looks forward to reporting in due course. Restated documents, should any
            arise, will be marked with appropriate discretion.
          </div>
        )}
      </div>
      {filings.map((f) => (
        <div key={f.id} className="panel">
          <h2>
            {f.quarter}
            {f.restated ? ' (restated)' : ''}
          </h2>
          <div className="email">
            <div className="body">{f.body}</div>
          </div>
        </div>
      ))}
    </>
  );
}

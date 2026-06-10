import { InvestorPanel } from '@/components/InvestorPanel';

export const dynamic = 'force-dynamic';

export default function InvestorPage() {
  return (
    <>
      <div className="panel">
        <h2>Investor Centre</h2>
        <p className="smallprint">
          Each visitor receives a notional £10,000, which the Company emphasises is notional.
          Past performance is not a guide to future performance. Neither, frankly, is present
          performance.
        </p>
      </div>
      <InvestorPanel />
    </>
  );
}

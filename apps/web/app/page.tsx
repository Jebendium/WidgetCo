import { TodayLive } from '@/components/TodayLive';
import AgmPage from './agm/page';
import DataRoomPage from './dataroom/page';
import FilingsPage from './filings/page';
import InvestorPage from './investor/page';
import LedgerPage from './ledger/page';

export const dynamic = 'force-dynamic';

export default async function OfficePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const replay = params.replay !== undefined;

  // Every section server-renders here and slides over the office. The
  // standalone routes remain for deep links, but nobody need ever leave.
  return (
    <TodayLive
      replay={replay}
      sections={{
        'Data Room': <DataRoomPage />,
        'General Ledger': <LedgerPage />,
        Filings: <FilingsPage />,
        'Investor Centre': <InvestorPage />,
        AGM: <AgmPage />,
      }}
    />
  );
}

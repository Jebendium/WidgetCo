import { TodayLive } from '@/components/TodayLive';

export const dynamic = 'force-dynamic';

export default async function OfficePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const replay = params.replay !== undefined;

  return <TodayLive replay={replay} />;
}

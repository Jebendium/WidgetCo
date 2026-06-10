import { TodayLive } from '@/components/TodayLive';

export const dynamic = 'force-dynamic';

export default async function OfficePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const replay = params.replay !== undefined;

  return (
    <>
      <TodayLive replay={replay} />
      <div className="panel smallprint">
        <p>
          Visitors are reminded that prodding members of staff, while not prohibited, is
          recorded, aggregated, and raised through the proper channels. The Company is aware of
          the disturbances.
        </p>
      </div>
    </>
  );
}

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
          The office itself — desks, kettle, personnel, disturbances — will be visible here in
          due course. The Premises and Facilities Committee is aware of the timeline.
        </p>
      </div>
    </>
  );
}

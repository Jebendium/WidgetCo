// The Data Room: the Company's internal correspondence, in full, in public,
// for reasons the Company has not examined. Emails reveal with their events.

import { SubmitBox } from '@/components/SubmitBox';
import { getDay, getDays } from '@/lib/data';
import { gateEvents } from '@/lib/feed';
import { agentName, ukDate, ukTime } from '@/lib/format';
import type { SimDayFile, SimEmail } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface RevealedEmail {
  email: SimEmail;
  ts: string;
}

/** Emails whose announcing event has revealed, with their reveal times. */
function revealedEmails(file: SimDayFile, now: Date): RevealedEmail[] {
  const gated = gateEvents(file.events, now);
  const tsByEventId = new Map(gated.events.map((e) => [e.id, e.ts]));
  return file.emails
    .filter((m) => tsByEventId.has(m.eventId))
    .map((m) => ({ email: m, ts: tsByEventId.get(m.eventId) ?? '' }));
}

function EmailView({ item }: { item: RevealedEmail }) {
  const m = item.email;
  return (
    <div className="email">
      <div className="headers">
        <div>
          <strong>From:</strong> {agentName(m.from)} <span className="smallprint">{ukTime(item.ts)}</span>
        </div>
        <div>
          <strong>To:</strong> {m.to.map(agentName).join('; ')}
        </div>
        {m.cc.length > 0 && (
          <div>
            <strong>CC:</strong> {m.cc.map(agentName).join('; ')}
          </div>
        )}
        <div>
          <strong>Subject:</strong> {m.subject}
        </div>
      </div>
      <div className="body">{m.body}</div>
    </div>
  );
}

export default async function DataRoomPage() {
  const now = new Date();
  const days = (await getDays()).reverse();
  const files = await Promise.all(days.map((day) => getDay(day)));

  return (
    <>
      <div className="panel">
        <h2>The Data Room</h2>
        <p className="smallprint">
          Internal correspondence of the Group, presented unredacted. The Company is confident
          it has nothing to hide and has not checked.
        </p>
      </div>
      <SubmitBox
        kind="tip"
        prompt="Seen something? Submit a confidential tip"
        button="Blow the whistle, gently"
      />
      {days.length === 0 && (
        <div className="placeholder-notice">No correspondence yet. The post is late.</div>
      )}
      {days.map((day, i) => {
        const file = files[i];
        if (!file) return null;
        const emails = revealedEmails(file, now);
        if (emails.length === 0) return null;
        return (
          <section key={day} className="panel">
            <h2>
              Day {day} — {ukDate(file.date)}
            </h2>
            {emails.map((item) => (
              <EmailView key={item.email.id} item={item} />
            ))}
          </section>
        );
      })}
    </>
  );
}

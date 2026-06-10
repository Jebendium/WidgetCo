import type { JSX } from 'react';
import { agentName, payloadText, payloadList, ukTime } from '@/lib/format';
import { gbp } from '@/lib/publicLedger';
import type { PublicEvent } from '@/lib/types';

function EmailCard({ ev }: { ev: PublicEvent }) {
  const to = payloadList(ev.payload, 'to').join(', ');
  return (
    <span>
      ✉ <strong>{agentName(ev.agentId)}</strong>
      {to ? ` → ${to}` : ''}: “{payloadText(ev.payload, 'subject', '(no subject)')}”
      <span className="smallprint"> — full text in the Data Room</span>
    </span>
  );
}

function LedgerCard({ ev }: { ev: PublicEvent }) {
  if (ev.payload.rejected === true) {
    return (
      <span>
        ✗ Journal entry REJECTED — “{payloadText(ev.payload, 'memo', '(no memo)')}”:{' '}
        {payloadText(ev.payload, 'reason')}
      </span>
    );
  }
  return (
    <span>
      ✓ Journal entry {payloadText(ev.payload, 'entryId')} posted — “
      {payloadText(ev.payload, 'memo')}”
    </span>
  );
}

function AnnouncementCard({ ev }: { ev: PublicEvent }) {
  return (
    <span>
      <strong>RNS — {payloadText(ev.payload, 'headline', '(untitled announcement)')}</strong>
      <br />
      {payloadText(ev.payload, 'body')}
    </span>
  );
}

function MeetingCard({ ev }: { ev: PublicEvent }) {
  const attendees = payloadList(ev.payload, 'attendees').join(', ');
  return (
    <span>
      📅 Meeting: “{payloadText(ev.payload, 'title')}” — {payloadText(ev.payload, 'when', 'TBC')}
      {attendees ? ` (${attendees})` : ''}
    </span>
  );
}

function ExpenseCard({ ev }: { ev: PublicEvent }) {
  const amount = ev.payload.amountPence;
  return (
    <span>
      🧾 Expense filed: {payloadText(ev.payload, 'description')}
      {typeof amount === 'number' ? ` — ${gbp(amount)}` : ''} (approved automatically)
    </span>
  );
}

function body(ev: PublicEvent): JSX.Element {
  switch (ev.kind) {
    case 'email':
      return <EmailCard ev={ev} />;
    case 'ledger':
      return <LedgerCard ev={ev} />;
    case 'announcement':
      return <AnnouncementCard ev={ev} />;
    case 'meeting':
      return <MeetingCard ev={ev} />;
    case 'expense':
      return <ExpenseCard ev={ev} />;
    default:
      return <span>{payloadText(ev.payload, 'memo', 'An item was processed.')}</span>;
  }
}

export function EventCard({ ev }: { ev: PublicEvent }) {
  return (
    <div className={`event kind-${ev.kind}`}>
      <div className="meta">
        {ukTime(ev.ts)} — {agentName(ev.agentId)}
      </div>
      {body(ev)}
    </div>
  );
}

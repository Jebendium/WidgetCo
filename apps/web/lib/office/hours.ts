// The company observes UK working hours (hard invariant #7): weekdays,
// 09:00–17:30 UK, dark otherwise. Bank holidays are enforced engine-side by
// the cron schedule; the canvas only needs the daily/weekly rhythm.

const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 17 * 60 + 30;

interface UkClock {
  weekday: string;
  minuteOfDay: number;
}

function ukClock(now: Date): UkClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return { weekday: get('weekday'), minuteOfDay: hour * 60 + minute };
}

/** Is the office open at this instant (UK weekday, 09:00–17:30)? */
export function isOfficeOpen(now: Date): boolean {
  const { weekday, minuteOfDay } = ukClock(now);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return minuteOfDay >= OPEN_MIN && minuteOfDay <= CLOSE_MIN;
}

/** The closed-office caption, with the one Sunday exception that is a clue. */
export function closedCaption(now: Date): string {
  const { weekday } = ukClock(now);
  if (weekday === 'Sun') {
    return 'The office is closed. One light is on. Internal Audit works Sundays.';
  }
  return 'The office is closed. The kettle is cold. Trading resumes at 09:00.';
}

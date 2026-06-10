// Prints 'yes' if today is a UK working day (the company is closed on
// England & Wales bank holidays — hard invariant #7), else 'no'. On any
// failure to reach gov.uk, assumes a working day: the company errs on the
// side of attendance.

const BANK_HOLIDAYS_URL = 'https://www.gov.uk/bank-holidays.json';

interface BankHolidayFeed {
  'england-and-wales'?: { events?: { date?: string }[] };
}

async function isBankHoliday(dateISO: string): Promise<boolean> {
  try {
    const res = await fetch(BANK_HOLIDAYS_URL);
    if (!res.ok) return false;
    const feed = (await res.json()) as BankHolidayFeed;
    const events = feed['england-and-wales']?.events ?? [];
    return events.some((e) => e.date === dateISO);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(now);
  if (weekday === 'Sat' || weekday === 'Sun') {
    console.log('no');
    return;
  }
  const dateISO = now.toISOString().slice(0, 10);
  console.log((await isBankHoliday(dateISO)) ? 'no' : 'yes');
}

main().catch(() => {
  console.log('yes');
});

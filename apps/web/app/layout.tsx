import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { runningCostLine } from '@/lib/data';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amalgamated Widget Holdings plc',
  description:
    'A diversified light-engineering and widget-solutions group operating principally in the West Midlands and, for reasons that are entirely proper, the Cayman Islands.',
};

const NAV = [
  ['/', 'The Office'],
  ['/dataroom', 'Data Room'],
  ['/ledger', 'General Ledger'],
  ['/filings', 'Filings'],
  ['/investor', 'Investor Centre'],
  ['/agm', 'AGM'],
] as const;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const costLine = await runningCostLine();
  return (
    <html lang="en-GB">
      <body>
        <header className="masthead">
          <h1 className="plc">Amalgamated Widget Holdings plc</h1>
          <p className="mission">&ldquo;Widgets, considered properly.&rdquo; — est. 1962</p>
          <nav>
            {NAV.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="colophon">
          <p>
            Amalgamated Widget Holdings plc is a fictional company. Its officers, products,
            subsidiaries, filings and misfortunes are fictional. Any resemblance to actual
            companies, persons or widgets, living or discontinued, is coincidental.
          </p>
          <p>
            {costLine} The Group is solvent, the accounts are true and fair, and the
            carrying value of the Coventry warehouse is supportable.
          </p>
        </footer>
      </body>
    </html>
  );
}

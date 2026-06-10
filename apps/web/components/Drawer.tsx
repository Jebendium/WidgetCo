'use client';

// Slide-out panel over the office. Closed: a labelled tab at the screen edge.
// Open: ~40% of the stage; expandable to ~60% for proper reading. The office
// remains the page; everything else is furniture that knows its place.

import { useState, type ReactNode } from 'react';

export function Drawer({
  side,
  label,
  children,
  defaultOpen = false,
}: {
  side: 'left' | 'right';
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [wide, setWide] = useState(false);

  return (
    <div className={`drawer drawer-${side} ${open ? 'open' : ''} ${wide ? 'wide' : ''}`}>
      <button
        className="drawer-tab"
        onClick={() => {
          setOpen(!open);
        }}
        aria-expanded={open}
      >
        {label}
      </button>
      <div className="drawer-body">
        <div className="drawer-controls">
          <button
            onClick={() => {
              setWide(!wide);
            }}
            title={wide ? 'Narrower' : 'Wider'}
          >
            {wide ? (side === 'right' ? '→' : '←') : side === 'right' ? '←' : '→'}
          </button>
          <button
            onClick={() => {
              setOpen(false);
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="drawer-content">{children}</div>
      </div>
    </div>
  );
}

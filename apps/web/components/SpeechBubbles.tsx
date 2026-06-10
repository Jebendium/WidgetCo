'use client';

// Speech bubbles are absolutely-positioned DOM elements overlaid on the
// canvas — never drawn in canvas (CLAUDE.md). CSS does the text, the tail and
// the fade far better than canvas text APIs would.

import { useEffect } from 'react';
import { useOfficeStore } from '@/lib/office/store';
import { WORLD } from '@/lib/office/waypoints';

export function SpeechBubbles() {
  const bubbles = useOfficeStore((s) => s.bubbles);

  useEffect(() => {
    const id = setInterval(() => {
      const store = useOfficeStore.getState();
      store.expireBubbles(Date.now());
      // Corridor chats: fetch an in-voice line for anyone who just stopped to talk.
      for (const agentId of store.takeChatRequests()) {
        void fetch(`/api/poke?agent=${encodeURIComponent(agentId)}`)
          .then(async (res) => (res.ok ? ((await res.json()) as { line?: string }) : {}))
          .then((data) => {
            if (data.line) useOfficeStore.getState().speak(agentId, data.line, Date.now());
          })
          .catch(() => undefined);
      }
    }, 500);
    return () => {
      clearInterval(id);
    };
  }, []);

  return (
    <>
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="speech-bubble"
          style={{
            left: `${(b.x / WORLD.width) * 100}%`,
            top: `${(b.y / WORLD.height) * 100}%`,
          }}
        >
          {b.text}
        </div>
      ))}
    </>
  );
}

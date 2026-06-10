'use client';

// Untrusted submission form (tips and AGM questions). 280 characters; the
// Company reads everything and acts on its own schedule.

import { useState } from 'react';

export function SubmitBox({
  kind,
  prompt,
  button,
}: {
  kind: 'tip' | 'agm';
  prompt: string;
  button: string;
}) {
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async () => {
    setNotice('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, body }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
      setNotice(data.ok ? (data.message ?? 'Received.') : (data.error ?? 'Not received.'));
      if (data.ok) setBody('');
    } catch {
      setNotice('The submission channel is experiencing a period of reflection.');
    }
  };

  return (
    <div className="panel">
      <h2>{prompt}</h2>
      <p>
        <textarea
          maxLength={280}
          rows={3}
          style={{ width: '100%' }}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
          }}
          aria-label={prompt}
        />
      </p>
      <p>
        <button
          onClick={() => {
            void submit();
          }}
        >
          {button}
        </button>{' '}
        <span className="smallprint">{body.length}/280 — reviewed before the next business day.</span>
      </p>
      {notice && <p className="smallprint">{notice}</p>}
    </div>
  );
}

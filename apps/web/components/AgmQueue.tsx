'use client';

// The queued AGM questions, with voting. The Board answers the most
// supported questions first, a policy it describes as "chronological".

import { useCallback, useEffect, useState } from 'react';

interface Question {
  id: number;
  body: string;
  votes: number;
}

export function AgmQueue() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [voted, setVoted] = useState<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/agm');
      const data = (await res.json()) as { ok: boolean; questions?: Question[] };
      if (data.ok && data.questions) setQuestions(data.questions);
    } catch {
      // the queue keeps its counsel
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const vote = async (id: number) => {
    if (voted.has(id)) return;
    setVoted(new Set([...voted, id]));
    try {
      await fetch('/api/agm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      // minuted in spirit
    }
    void refresh();
  };

  if (questions.length === 0) return null;

  return (
    <div className="panel">
      <h2>Questions awaiting the Board</h2>
      <p className="smallprint">
        Second another shareholder’s question to raise its standing. The Board takes questions
        in order of receipt, adjusted for circumstances.
      </p>
      {questions.map((q) => (
        <p key={q.id}>
          <button
            onClick={() => {
              void vote(q.id);
            }}
            disabled={voted.has(q.id)}
            title="Second this question"
          >
            ▲ {q.votes}
          </button>{' '}
          {q.body}
        </p>
      ))}
    </div>
  );
}

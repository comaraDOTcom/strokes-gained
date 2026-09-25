'use client';

/**
 * Coaching at the moment it's needed: on a player's first round, before any hole is finished, the
 * three things a shot needs. "Got it" hides it in this browser; finishing a hole hides it anyway.
 */
import { useEffect, useState } from 'react';
import { LOGGING_STEPS } from '@/lib/learn/onboarding';

const KEY = 'sg-first-shot-tip-v1';

export function FirstShotTip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(KEY) !== 'dismissed');
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, 'dismissed');
    } catch {
      /* private mode: it just comes back next visit */
    }
  }

  if (!show) return null;
  return (
    <aside className="space-y-2 rounded-xl border border-accent/40 bg-accent-soft p-3" aria-label="Your first shot">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">Your first shot, from the tee</p>
        <button type="button" onClick={dismiss} className="text-sm text-ink-2 underline underline-offset-2">
          Got it
        </button>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
        {LOGGING_STEPS.map((s) => (
          <li key={s.title}>
            <b className="text-ink">{s.title}</b> {s.text}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        Then <b>Save shot</b>. The next shot starts where this one finished. Wrong number? <b>Undo last shot</b>.
      </p>
    </aside>
  );
}

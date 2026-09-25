'use client';

/**
 * A one-time "how to read a round card" tip on Rounds, pointing into the Learn hub's scroll-through
 * tour. Dismissal is remembered in this browser only (a convenience, not state that matters), and
 * the tip stays hidden until mounted so the server render never flashes it.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'sg-rounds-tip-v1';

export function RoundsTip() {
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

  if (!show) {
    return (
      <p className="text-sm text-ink-2">
        <Link href="/learn" className="underline underline-offset-2">
          How to read these numbers
        </Link>
      </p>
    );
  }

  return (
    <aside className="space-y-3 rounded-xl border border-accent/40 bg-accent-soft p-4" aria-label="How to read a round">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">New here? How to read a round</p>
        <button type="button" onClick={dismiss} className="text-sm text-ink-2 underline underline-offset-2">
          Got it
        </button>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
        <li>
          <b className="text-ink">The hexagon is shot quality.</b> 100 is a scratch golfer&apos;s average shot; 90 means each shot
          lost about a tenth of a stroke. Tap it for what your number means.
        </li>
        <li>
          <b className="text-ink">SG is strokes gained</b> against a scratch golfer for the whole round. −10.4 means scratch
          would have scored about 10 better from the same holes.
        </li>
        <li>
          <b className="text-ink">Strongest and Work on</b> split that total by area, so you know whether it was the driving,
          the approaches or the putting.
        </li>
      </ol>
      <Link href="/learn" className="inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper">
        Take the 1-minute tour
      </Link>
    </aside>
  );
}

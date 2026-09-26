'use client';

/**
 * The shot-quality hexagon, tappable: opens a small card saying what this number means in this
 * round's own terms, with links into the Learn hub. Hover titles don't exist on a phone, so the
 * explanation has to be a tap away.
 */
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { QualityStat } from '@/lib/insights/quality';
import { explainQuality, qualityBand } from '@/lib/learn/explain';
import { QualityBadge } from './quality-badge';

const CARD_W = 288;
const GUTTER = 16;

export function QualityInfo({ stat, size = 'sm' }: { stat: QualityStat | null; size?: 'sm' | 'lg' }) {
  // Fixed-position card, placed under the badge and clamped inside the viewport: the badge moves
  // between the right of a card (desktop) and the left (phone, where the header wraps).
  const [open, setOpen] = useState<{ left: number; top: number } | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  /** Where the card goes for the badge's current position; null once the badge is off screen. */
  function place(): { left: number; top: number } | null {
    const b = btn.current;
    if (!b) return null;
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return null;
    const vw = document.documentElement.clientWidth;
    const w = Math.min(CARD_W, vw - 2 * GUTTER);
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, GUTTER), vw - GUTTER - w);
    return { left, top: r.bottom + 8 };
  }
  const id = useId();

  const isOpen = open !== null;
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    // Follow the badge as the page moves; close once it has scrolled away.
    const onScroll = () => setOpen(place());
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [isOpen]); // bind the listeners on open, drop them on close

  if (!stat) return <QualityBadge stat={null} size={size} />;
  const e = explainQuality(stat);

  return (
    <span ref={box} className="relative inline-flex">
      <button
        type="button"
        ref={btn}
        onClick={() => setOpen(open ? null : place())}
        aria-expanded={open !== null}
        aria-controls={id}
        aria-label={`Shot quality ${Math.round(stat.quality)}. What does this mean?`}
        className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <QualityBadge stat={stat} size={size} />
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label="What shot quality means"
          style={{ left: open.left, top: open.top, width: `min(${CARD_W}px, calc(100vw - ${2 * GUTTER}px))` }}
          className="fixed z-30 space-y-2 rounded-xl border bg-card p-3 text-left text-sm shadow-lg"
        >
          <span className="block font-mono text-[10px] uppercase tracking-wide text-muted">Shot quality · 100 = scratch</span>
          <span className="block font-medium text-ink">{e.headline}</span>
          <span className="block text-ink-2">
            {e.detail} That&apos;s {qualityBand(stat.quality)}.
          </span>
          {e.caveat && <span className="block text-xs text-warn">{e.caveat}</span>}
          <span className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
            <Link href="/learn#shot-quality" className="text-accent underline underline-offset-2">
              How the hexagon works
            </Link>
            <Link href="/learn#strokes-gained" className="text-accent underline underline-offset-2">
              What strokes gained is
            </Link>
          </span>
        </span>
      )}
    </span>
  );
}

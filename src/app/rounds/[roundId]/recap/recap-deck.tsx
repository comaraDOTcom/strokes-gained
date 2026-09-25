'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoundRecap } from '@/lib/insights/recap';
import { AreaCard, HoleRow, QualityBars, ShotGroupsBody, SkillBars, sgClass } from '@/app/recap-parts';
import { QualityBadge } from '@/app/quality-badge';
import { formatQuality, type RoundQuality } from '@/lib/insights/quality';
import { swipeToHoleDelta } from '@/lib/rounds/entry';
import { fmtSg } from '@/lib/insights/chart-colors';

type Slide = { key: string; kicker: string; heading: string; body: React.ReactNode };

export function RecapDeck({
  roundId,
  title,
  subtitle,
  recap,
  quality,
}: {
  roundId: number;
  title: string;
  subtitle: string;
  recap: RoundRecap;
  quality: RoundQuality;
}) {
  const gained = recap.sgTotal >= 0;
  const slides: Slide[] = [
    {
      key: 'headline',
      kicker: subtitle,
      heading: title,
      body: (
        <div className="space-y-5 text-center">
          <div>
            <p className="text-7xl font-semibold leading-none">{recap.score}</p>
            <p className="mt-1 font-mono text-sm text-muted">
              {recap.toPar === 0 ? 'level par' : `${recap.toPar > 0 ? '+' : ''}${recap.toPar} to par`} · {recap.holesPlayed} hole
              {recap.holesPlayed === 1 ? '' : 's'} · {recap.shotCount} shots logged
            </p>
          </div>
          <div>
            <p className={`font-mono text-4xl font-medium ${sgClass(recap.sgTotal)}`}>{fmtSg(recap.sgTotal)}</p>
            <p className="font-mono text-xs uppercase tracking-wide text-muted">strokes gained vs scratch</p>
          </div>
          {quality.overall && (
            <div className="flex justify-center">
              <QualityBadge stat={quality.overall} size="lg" />
            </div>
          )}
          <p className="text-ink-2">
            {gained
              ? `You beat a scratch golfer by ${Math.abs(recap.sgTotal).toFixed(1)} strokes. Here's how.`
              : `You gave up ${Math.abs(recap.sgTotal).toFixed(1)} strokes to a scratch golfer. Here's where they went — and what went right.`}
          </p>
        </div>
      ),
    },
    {
      key: 'best-holes',
      kicker: 'The good',
      heading: `Your best ${recap.bestHoles.length === 1 ? 'hole' : `${recap.bestHoles.length} holes`}`,
      body: <ul className="space-y-2">{recap.bestHoles.map((h) => <HoleRow key={h.holeNo} h={h} />)}</ul>,
    },
    ...(recap.worstHoles.length
      ? [{
          key: 'worst-holes',
          kicker: 'The damage',
          heading: `Your worst ${recap.worstHoles.length === 1 ? 'hole' : `${recap.worstHoles.length} holes`}`,
          body: (
            <div className="space-y-3">
              <ul className="space-y-2">{recap.worstHoles.map((h) => <HoleRow key={h.holeNo} h={h} />)}</ul>
              <p className="text-sm text-muted">
                Together they cost {Math.abs(recap.worstHoles.reduce((a, h) => a + h.sg, 0)).toFixed(1)} strokes
                {recap.sgTotal < 0 && ` — ${Math.round((recap.worstHoles.reduce((a, h) => a + h.sg, 0) / recap.sgTotal) * 100)}% of everything you lost`}.
              </p>
            </div>
          ),
        } satisfies Slide]
      : []),
    {
      key: 'best-shots',
      kicker: 'Shots to remember',
      heading: 'Your best shots',
      body: <ShotGroupsBody groups={recap.bestShots} />,
    },
    ...(recap.worstShots.longGame.length + recap.worstShots.putts.length
      ? [{
          key: 'worst-shots',
          kicker: 'Shots to forget',
          heading: 'Your worst shots',
          body: <ShotGroupsBody groups={recap.worstShots} />,
        } satisfies Slide]
      : []),
    ...(quality.overall && quality.byCategory.length > 0
      ? [{
          key: 'quality',
          kicker: 'Shot quality',
          heading: `Shot quality ${formatQuality(quality.overall.quality)}`,
          body: (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <QualityBadge stat={quality.overall} size="lg" />
                <p className="text-ink-2">
                  {quality.overall.sg >= 0
                    ? 'Shot for shot, you played better than a scratch golfer today.'
                    : `Shot for shot, a scratch golfer would have gained ${Math.abs(quality.overall.sg).toFixed(1)} strokes on you over these ${quality.overall.shots} shots.`}
                </p>
              </div>
              <div className="rounded-xl border bg-paper p-4">
                <QualityBars areas={quality.byCategory} />
              </div>
              <p className="text-xs text-muted">
                100 is a scratch golfer&apos;s average shot; each point is a hundredth of a stroke per shot. Faded rows have
                fewer than 10 shots — one great bunker shot doesn&apos;t make a 148.{' '}
                <Link href="/learn#shot-quality" className="underline underline-offset-2">
                  More on shot quality
                </Link>
              </p>
            </div>
          ),
        } satisfies Slide]
      : []),
    ...(recap.strongArea && recap.weakArea
      ? [{
          key: 'areas',
          kicker: 'The takeaway',
          heading: 'Strong area, weak area',
          body: (
            <div className="space-y-3">
              <AreaCard a={recap.strongArea} tone={recap.strongArea.sg >= 0 ? 'pos' : 'neg'} kicker={recap.strongArea.sg >= 0 ? 'Strongest' : 'Held up best'} />
              <AreaCard a={recap.weakArea} tone="neg" kicker="Work on this" />
              {recap.strongArea.sg < 0 && (
                <p className="text-sm text-muted">Even your best area lost a little to scratch — that&apos;s a high bar, not a bad round.</p>
              )}
              <div className="space-y-2 rounded-xl border bg-paper p-4">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">Every area</p>
                <SkillBars areas={recap.areas} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/insights" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper">
                  See full insights
                </Link>
                <Link href={`/rounds/${roundId}`} className="rounded-lg border border-line-strong px-4 py-2 text-sm">
                  Back to the round
                </Link>
              </div>
            </div>
          ),
        } satisfies Slide]
      : []),
  ];

  const [i, setI] = useState(0);
  const last = slides.length - 1;
  const go = useCallback((d: number) => setI((cur) => Math.min(last, Math.max(0, cur + d))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const slide = slides[i]!;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={i + 1}>
          {slides.map((s, n) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Go to ${s.heading}`}
              onClick={() => setI(n)}
              className={`h-1.5 flex-1 rounded-full ${n <= i ? 'bg-ink' : 'bg-line-strong'}`}
            />
          ))}
        </div>
        <Link href={`/rounds/${roundId}`} className="text-sm text-muted underline underline-offset-2">
          Skip
        </Link>
      </div>

      {/* Tap the right side for next, the left for back; swipe works too. */}
      <section
        aria-live="polite"
        className="min-h-[28rem] cursor-pointer select-none rounded-2xl border bg-card p-5 touch-pan-y"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const from = touch.current;
          const t = e.changedTouches[0];
          touch.current = null;
          if (!from || !t) return;
          const d = swipeToHoleDelta({ startX: from.x, startY: from.y, endX: t.clientX, endY: t.clientY, viewportWidth: window.innerWidth });
          if (d !== 0) {
            swiped.current = true; // the click that follows a swipe must not also advance
            go(d);
          }
        }}
        onClick={(e) => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          if ((e.target as HTMLElement).closest('a,button')) return;
          const box = e.currentTarget.getBoundingClientRect();
          go(e.clientX - box.left < box.width * 0.3 ? -1 : 1);
        }}
      >
        <p className="font-mono text-xs uppercase tracking-wide text-muted">{slide.kicker}</p>
        <h1 className="mb-4 text-2xl font-semibold leading-tight">{slide.heading}</h1>
        {slide.body}
      </section>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} className="rounded-lg border border-line-strong px-4 py-2 text-sm disabled:opacity-30">
          ‹ Back
        </button>
        <span className="font-mono text-xs text-muted">
          {i + 1} / {slides.length}
        </span>
        {i < last ? (
          <button type="button" onClick={() => go(1)} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper">
            Next ›
          </button>
        ) : (
          <Link href={`/rounds/${roundId}`} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper">
            Done
          </Link>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * The five-screen welcome deck. Same feel as the round recap: a progress bar, Skip in the corner,
 * swipe or tap to move, Back / Next in the thumb zone. One idea per screen, all of it skippable,
 * and the last screen is a real action (log the first round), not a "Done".
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Tour } from '@/lib/learn/tour';
import { LOGGING_STEPS, clampStep, detectPlatform, installGuide, type Platform } from '@/lib/learn/onboarding';
import { swipeToHoleDelta } from '@/lib/rounds/entry';
import { fmtSg } from '@/lib/insights/chart-colors';
import { QualityBadge } from '@/app/quality-badge';

type Slide = { key: string; kicker: string; heading: string; body: React.ReactNode };

const sgClass = (v: number) => (v >= 0 ? 'text-pos' : 'text-neg');

/** Illustrative only: the kind of split a scorecard can't show. Labelled as an example on screen. */
const EXAMPLE_AREAS: { label: string; sg: number }[] = [
  { label: 'Off the tee', sg: -0.8 },
  { label: 'Approach', sg: -4.1 },
  { label: 'Short game', sg: -1.2 },
  { label: 'Putting', sg: -1.9 },
];

function ExampleSplit() {
  const max = Math.max(...EXAMPLE_AREAS.map((a) => Math.abs(a.sg)));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border bg-paper p-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted">The scorecard says</p>
        <p className="mt-1 text-3xl font-semibold leading-none">84</p>
        <p className="mt-2 font-mono text-xs text-ink-2">36 putts · 7 greens · 8 fairways</p>
        <p className="mt-2 text-xs text-muted">Counts. They can&apos;t tell bad putting from approaches that kept leaving 40 feet.</p>
      </div>
      <div className="rounded-xl border bg-paper p-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Strokes gained says (example)</p>
        <ul className="mt-2 space-y-1.5">
          {EXAMPLE_AREAS.map((a) => (
            <li key={a.label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs">
              <span className="text-ink-2">{a.label}</span>
              <span className="h-2 rounded-full bg-neg-soft">
                <span className="block h-2 rounded-full bg-neg" style={{ width: `${(Math.abs(a.sg) / max) * 100}%` }} />
              </span>
              <span className={`font-mono ${sgClass(a.sg)}`}>{fmtSg(a.sg, 1)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">Half the damage is approach play. That&apos;s the practice session.</p>
      </div>
    </div>
  );
}

function BogeyLedger({ tour }: { tour: Tour }) {
  const worst = [...tour.shots].sort((a, b) => a.sg - b.sg).filter((s) => s.sg < -0.05);
  return (
    <div className="space-y-3">
      <p className="rounded-lg border bg-paper p-3 text-sm">
        Every shot: <b className="font-mono">scratch&apos;s strokes from where you started</b> −{' '}
        <b className="font-mono">from where you finished</b> − <b className="font-mono">1</b>.
      </p>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
          A bogey on a {tour.yards}-yard par {tour.par}, scored by the app
        </p>
        <ul className="mt-1.5 flex gap-1">
          {tour.shots.map((s) => (
            <li key={s.shotNo} className="flex min-w-0 flex-1 flex-col items-center rounded-md border bg-card px-1 py-1.5">
              <span className="truncate font-mono text-[9px] uppercase tracking-wide text-muted">
                {s.title.replace(/^The /, '')}
              </span>
              <span className={`font-mono text-xs font-medium ${sgClass(s.sg)}`}>{fmtSg(s.sg)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-sm">
          {tour.teeExpected.toFixed(2)} expected − {tour.strokes} taken = <b className={sgClass(tour.totalSg)}>{fmtSg(tour.totalSg)}</b>
        </p>
      </div>
      <p className="text-sm text-ink-2">
        The card just says 5. The sum says the bogey came from the{' '}
        {worst.map((s) => s.title.replace(/^The /, '').toLowerCase()).join(' and the ')}: the drive and bunker shot were
        better than scratch. That&apos;s the difference between a score and something to practise.
      </p>
      <Link href="/learn#strokes-gained" className="inline-block text-sm text-accent underline underline-offset-2">
        Play the hole shot by shot on Learn
      </Link>
    </div>
  );
}

function LoggingSteps() {
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {LOGGING_STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-2 rounded-lg border bg-paper p-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-sm text-paper">{i + 1}</span>
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="mt-0.5 text-sm text-ink-2">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
        <li>Log as you walk, or after the round from memory and the scorecard. About ten seconds a hole once it&apos;s familiar.</li>
        <li>
          Start with <b className="text-ink">Brief</b>. <b className="text-ink">Detailed</b> also asks where you missed and how
          each putt broke; switch when you want that.
        </li>
        <li>Mistyped? <b className="text-ink">Undo last shot</b>, or <b className="text-ink">Edit</b> any shot later. Nothing is final.</li>
      </ul>
    </div>
  );
}

function WhatYouGet() {
  const stages = [
    {
      when: 'After one round',
      what: 'A recap you can swipe through: your score, strokes gained against scratch, the shot-quality hexagon, your strongest area and the one to work on, best and worst holes.',
    },
    {
      when: 'After a few',
      what: 'Insights: strokes gained by area across rounds, the costliest shots, and where you tend to miss.',
    },
    {
      when: 'After four or more',
      what: 'Trends, and a ranked What to work on: how much each area matters × how much you lose there.',
    },
  ];
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {stages.map((s) => (
          <li key={s.when} className="rounded-lg border bg-paper p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{s.when}</p>
            <p className="mt-0.5 text-sm text-ink-2">{s.what}</p>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <QualityBadge stat={{ quality: 100, shots: 72, sg: 0, thin: false }} />
        <p className="text-sm text-ink-2">
          <b className="text-ink">The hexagon is shot quality:</b> 100 is a scratch golfer&apos;s average shot. Tap any hexagon
          in the app for what your number means.
        </p>
      </div>
      <p className="text-sm text-ink-2">
        <b className="text-ink">It&apos;s honest about small samples.</b> Three bunker shots prove nothing yet, and the app says
        so: thin numbers are faded and trends are labelled.
      </p>
    </div>
  );
}

function SetUp({ platform, courseCount }: { platform: Platform | null; courseCount: number }) {
  const guide = platform ? installGuide(platform) : null;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-paper p-3">
        <p className="font-medium">{guide?.title ?? 'Add it to your home screen'}</p>
        {guide && guide.steps.length > 0 && (
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-ink-2">
            {guide.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
        {guide?.note && <p className="mt-2 text-xs text-muted">{guide.note}</p>}
        {platform !== 'standalone' && (
          <p className="mt-2 text-xs text-muted">
            You&apos;re signed in now, so the icon opens straight to your rounds. Do this before the first round: it&apos;s the
            difference between a bookmark and an app.
          </p>
        )}
      </div>
      <div className="rounded-lg border bg-paper p-3">
        <p className="font-medium">Is your course in the library?</p>
        <p className="mt-0.5 text-sm text-ink-2">
          {courseCount > 0 ? `${courseCount} course${courseCount === 1 ? ' is' : 's are'} in it already.` : 'It is empty so far.'}{' '}
          If yours isn&apos;t, request it from{' '}
          <Link href="/courses" className="text-accent underline underline-offset-2">
            Courses
          </Link>{' '}
          and it&apos;ll be added for you: a photo of the scorecard or the club&apos;s website is enough.
        </p>
      </div>
    </div>
  );
}

export function WelcomeTour({
  greeting,
  tour,
  hasRounds,
  courseCount,
}: {
  greeting: string;
  tour: Tour;
  /** Reopened from Learn by someone who already plays: the last screen offers Rounds, not a first round. */
  hasRounds: boolean;
  courseCount: number;
}) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [leaving, setLeaving] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    // Client-only: the user agent and display mode aren't known on the server.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setPlatform(detectPlatform({ userAgent: window.navigator.userAgent, standalone, maxTouchPoints: window.navigator.maxTouchPoints }));
  }, []);

  const slides: Slide[] = [
    {
      key: 'why',
      kicker: greeting,
      heading: 'Your scorecard says 84. It doesn’t say why.',
      body: (
        <div className="space-y-3">
          <p className="text-ink-2">
            Strokes gained scores <b className="text-ink">every shot</b> against what a scratch golfer averages from the same
            spot, then adds them up by area. So instead of a score, you get where the strokes went.
          </p>
          <ExampleSplit />
        </div>
      ),
    },
    { key: 'how', kicker: 'How it’s scored', heading: 'One sum, every shot', body: <BogeyLedger tour={tour} /> },
    { key: 'log', kicker: 'Logging a round', heading: 'Two taps and a number per shot', body: <LoggingSteps /> },
    { key: 'get', kicker: 'What you get back', heading: 'A recap after one round. A plan after four.', body: <WhatYouGet /> },
    { key: 'setup', kicker: 'Set up your phone', heading: 'Make it an app', body: <SetUp platform={platform} courseCount={courseCount} /> },
  ];
  const last = slides.length - 1;
  const slide = slides[i]!;

  function go(delta: number) {
    setI((n) => clampStep(n, delta, slides.length));
    // The deck is the whole page: back to the top so the new screen's heading isn't under the nav.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // go() only touches state setters and a ref, so binding once is safe

  /** Remember the tour was seen (best effort: a failed cookie just means it shows once more), then go. */
  async function finish(href: string) {
    setLeaving(true);
    try {
      await fetch('/api/onboarding', { method: 'POST' });
    } catch {
      /* fall through: the destination matters more than the cookie */
    }
    router.push(href);
  }

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
        <button type="button" onClick={() => void finish('/')} disabled={leaving} className="text-sm text-muted underline underline-offset-2">
          Skip
        </button>
      </div>

      <section
        aria-live="polite"
        className="min-h-[26rem] select-none rounded-2xl border bg-card p-5 touch-pan-y"
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
            swiped.current = true;
            go(d);
          }
        }}
        onClick={() => {
          // A swipe ends in a click on touch devices; that click must not also advance.
          if (swiped.current) swiped.current = false;
        }}
      >
        <p className="font-mono text-xs uppercase tracking-wide text-muted">{slide.kicker}</p>
        <h1 className="mb-4 text-2xl font-semibold leading-tight">{slide.heading}</h1>
        {slide.body}
      </section>

      {/* Sticky in the thumb zone; padded for the iPhone home indicator when installed. */}
      <div className="sticky bottom-0 -mx-3 bg-paper/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => go(-1)} disabled={i === 0} className="min-h-11 rounded-lg border border-line-strong px-4 text-sm disabled:opacity-30">
            ‹ Back
          </button>
          <span className="font-mono text-xs text-muted">
            {i + 1} / {slides.length}
          </span>
          {i < last ? (
            <button type="button" onClick={() => go(1)} className="min-h-11 rounded-lg bg-ink px-5 text-sm font-medium text-paper">
              Next ›
            </button>
          ) : hasRounds ? (
            <button type="button" onClick={() => void finish('/')} disabled={leaving} className="min-h-11 rounded-lg bg-ink px-5 text-sm font-medium text-paper disabled:opacity-50">
              Back to Rounds
            </button>
          ) : (
            <button type="button" onClick={() => void finish('/rounds/new')} disabled={leaving} className="min-h-11 rounded-lg bg-ink px-5 text-sm font-medium text-paper disabled:opacity-50">
              {leaving ? 'Opening…' : 'Log your first round'}
            </button>
          )}
        </div>
        {i === last && !hasRounds && (
          <button type="button" onClick={() => void finish('/')} disabled={leaving} className="mt-2 block w-full text-center text-sm text-ink-2 underline underline-offset-2">
            I&apos;ll look around first
          </button>
        )}
      </div>
    </div>
  );
}

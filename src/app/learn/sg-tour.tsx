'use client';

/**
 * "Strokes gained, one shot at a time": a scroll-driven walk through one bogey. The hole diagram
 * stays pinned while the steps scroll past; each step draws the next shot, coloured by the strokes
 * it gained (green) or lost (red), and the ledger keeps a running total.
 *
 * All numbers arrive as plain data from `buildTour()` (the real SG engine). Every step's text is in
 * the DOM from the start, so it reads fine without JS or with reduced motion.
 */
import { useEffect, useRef, useState } from 'react';
import type { Pt, Tour, TourShot } from '@/lib/learn/tour';

// The theme's gain/loss tokens (globals.css), so the tour matches the rest of the app in both themes.
const POS = 'var(--color-pos)';
const NEG = 'var(--color-neg)';
const sgColour = (v: number) => (v >= 0 ? POS : NEG);
const fmt = (v: number) => (Math.abs(v) < 0.005 ? '0.00' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`);

function curve(a: Pt, b: Pt, putt: boolean): string {
  if (putt) return `M${a.x},${a.y} L${b.x},${b.y}`;
  // A gentle draw: bow the flight to one side of the straight line.
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = 0.18;
  return `M${a.x},${a.y} Q${mx - dy * k},${my + dx * k} ${b.x},${b.y}`;
}

function HoleDiagram({ tour, shown, active }: { tour: Tour; shown: number; active: number }) {
  const current = shown === 0 ? tour.shots[0]!.from.at : tour.shots[shown - 1]!.to.at;
  const activeShot = active >= 1 && active <= tour.shots.length ? tour.shots[active - 1]! : null;
  return (
    <svg viewBox="0 0 200 420" className="h-full w-auto max-w-full" role="img" aria-label={`A ${tour.yards}-yard par ${tour.par}, with the shots played so far drawn on it`}>
      <rect x="0" y="0" width="200" height="420" rx="14" fill="#dfe6d2" />
      {/* fairway */}
      <path d="M86,398 C66,320 64,230 76,150 C82,112 88,96 100,92 C114,96 124,114 128,150 C134,236 130,318 114,398 Z" fill="#c9dab4" />
      {/* green, bunker, tee */}
      <ellipse cx="100" cy="48" rx="36" ry="27" fill="#b7d79b" stroke="#9cc07f" strokeWidth="1.5" />
      <ellipse cx="58" cy="72" rx="17" ry="10" fill="#efe2bf" stroke="#dccb9b" strokeWidth="1" />
      <rect x="88" y="390" width="24" height="12" rx="3" fill="#c9dab4" stroke="#a9bf92" />
      <text x="118" y="400" fontSize="9" fill="#6b6f66" fontFamily="var(--font-mono), ui-monospace, monospace">{tour.yards}y · par {tour.par}</text>
      {/* flag */}
      <line x1="100" y1="44" x2="100" y2="18" stroke="#16221c" strokeWidth="1.2" />
      <path d="M100,18 L116,23 L100,28 Z" fill="#e9b31c" />
      <circle cx="100" cy="44" r="2.2" fill="#16221c" />

      {tour.shots.map((s) => {
        const on = s.shotNo <= shown;
        const d = curve(s.from.at, s.to.at, s.from.lie === 'GREEN');
        return (
          <g key={s.shotNo}>
            <path d={d} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" pathLength={1}
              strokeDasharray="1" strokeDashoffset={on ? 0 : 1} className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none" opacity={0.85} />
            <path d={d} fill="none" stroke={sgColour(s.sg)} strokeWidth="2.6" strokeLinecap="round" pathLength={1}
              strokeDasharray="1" strokeDashoffset={on ? 0 : 1} className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none" />
            {on && s.to.lie !== null && <circle cx={s.to.at.x} cy={s.to.at.y} r="2.4" fill={sgColour(s.sg)} />}
          </g>
        );
      })}

      {/* the ball */}
      <circle cx={current.x} cy={current.y} r="4.2" fill="#fff" stroke="#16221c" strokeWidth="1.2"
        className="transition-all duration-700 ease-out motion-reduce:transition-none" />

      {activeShot && (
        <g transform={`translate(${Math.min(activeShot.to.at.x + 10, 150)},${Math.max(activeShot.to.at.y - 22, 6)})`}>
          <rect width="44" height="16" rx="4" fill={sgColour(activeShot.sg)} />
          <text x="22" y="11.5" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--color-paper)" fontFamily="var(--font-mono), ui-monospace, monospace">
            {fmt(activeShot.sg)}
          </text>
        </g>
      )}
    </svg>
  );
}

function Ledger({ tour, shown }: { tour: Tour; shown: number }) {
  const running = shown === 0 ? 0 : tour.shots[shown - 1]!.runningSg;
  return (
    <div className="flex items-stretch gap-1">
      {tour.shots.map((s) => {
        const on = s.shotNo <= shown;
        return (
          <div
            key={s.shotNo}
            className={`flex min-w-0 flex-1 flex-col items-center rounded-md border px-1 py-1 transition-opacity duration-500 ${on ? 'bg-card' : 'opacity-30'}`}
          >
            <span className="font-mono text-[9px] uppercase tracking-wide text-muted">shot {s.shotNo}</span>
            <span className="font-mono text-xs font-medium" style={{ color: on ? sgColour(s.sg) : undefined }}>
              {on ? fmt(s.sg) : '·'}
            </span>
          </div>
        );
      })}
      <div className="flex shrink-0 flex-col items-center rounded-md border border-ink bg-ink px-2 py-1 text-paper">
        <span className="font-mono text-[9px] uppercase tracking-wide opacity-70">total</span>
        <span className="font-mono text-xs font-medium">{shown === 0 ? '0.00' : fmt(running)}</span>
      </div>
    </div>
  );
}

function ShotStep({ s }: { s: TourShot }) {
  const gained = s.sg >= 0;
  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Shot {s.shotNo}</p>
      <h3 className="text-lg font-semibold">{s.title}</h3>
      <p className="text-ink-2">{s.story}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border bg-paper p-3 text-sm">
        <dt className="text-muted">Before</dt>
        <dd>
          {s.from.label}: scratch needs <b className="font-mono">{s.from.expected.toFixed(2)}</b> more
        </dd>
        <dt className="text-muted">After</dt>
        <dd>
          {s.to.label}
          {s.to.lie !== null ? (
            <>
              : scratch needs <b className="font-mono">{s.to.expected.toFixed(2)}</b> more
            </>
          ) : (
            ': nothing left to do'
          )}
        </dd>
        <dt className="text-muted">Cost</dt>
        <dd>1 stroke</dd>
      </dl>
      <p className="font-mono text-sm">
        {s.from.expected.toFixed(2)} − {s.to.expected.toFixed(2)} − 1 ={' '}
        <b style={{ color: sgColour(s.sg) }}>{fmt(s.sg)}</b>
      </p>
      <p className="text-sm text-ink-2">
        {Math.abs(s.sg) < 0.05
          ? 'About what a scratch golfer does from there: no gain, no loss.'
          : gained
            ? `Better than a scratch golfer's average from there: it gained ${s.sg.toFixed(2)} of a stroke.`
            : `Worse than a scratch golfer's average from there: it cost ${Math.abs(s.sg).toFixed(2)} of a stroke.`}
      </p>
    </>
  );
}

export function SgTour({ tour }: { tour: Tour }) {
  // Step 0 = the empty hole, 1..n = after shot n, n + 1 = the summary.
  const last = tour.shots.length + 1;
  const [active, setActive] = useState(0);
  const [navH, setNavH] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const nav = document.querySelector('nav');
    const measure = () => setNavH(nav ? nav.getBoundingClientRect().height : 0);
    measure();
    window.addEventListener('resize', measure);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      // A step is "current" while it crosses the lower-middle of the screen.
      { rootMargin: '-55% 0px -35% 0px' },
    );
    for (const el of refs.current) if (el) io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const shown = Math.min(active, tour.shots.length);
  const worst = [...tour.shots].sort((a, b) => a.sg - b.sg).filter((s) => s.sg < -0.05);
  const good = tour.shots.filter((s) => s.sg > 0.05);

  const step = (i: number, body: React.ReactNode) => (
    <section
      key={i}
      data-step={i}
      ref={(el) => {
        refs.current[i] = el;
      }}
      className="flex min-h-[70vh] items-center py-6 md:min-h-[80vh]"
    >
      <div
        className={`w-full space-y-3 rounded-xl border bg-card p-4 shadow-sm transition-opacity duration-300 ${active === i ? 'opacity-100' : 'opacity-50'}`}
      >
        {body}
      </div>
    </section>
  );

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8">
      <div className="sticky z-[5] -mx-4 bg-paper/95 px-4 pb-3 pt-2 backdrop-blur md:mx-0 md:self-start md:px-0" style={{ top: navH }}>
        <div className="flex h-[34vh] justify-center md:h-[62vh]">
          <HoleDiagram tour={tour} shown={shown} active={active} />
        </div>
        <div className="mt-2">
          <Ledger tour={tour} shown={shown} />
        </div>
      </div>

      <div>
        {step(
          0,
          <>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted">The benchmark</p>
            <h3 className="text-lg font-semibold">
              A {tour.yards}-yard par {tour.par}
            </h3>
            <p className="text-ink-2">
              From this tee, a scratch golfer takes <b className="font-mono">{tour.teeExpected.toFixed(2)}</b> strokes on
              average to finish the hole. That&apos;s the benchmark.
            </p>
            <p className="text-ink-2">
              Every shot is scored the same way: how many strokes scratch would need from where the ball started, minus
              how many from where it finished, minus the one stroke you just used. Scroll to play the hole.
            </p>
          </>,
        )}
        {tour.shots.map((s) => step(s.shotNo, <ShotStep s={s} />))}
        {step(
          last,
          <>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Add it up</p>
            <h3 className="text-lg font-semibold">
              {tour.strokes} strokes: a bogey, {fmt(tour.totalSg)}
            </h3>
            <p className="font-mono text-sm">
              {tour.teeExpected.toFixed(2)} expected − {tour.strokes} taken = <b style={{ color: sgColour(tour.totalSg) }}>{fmt(tour.totalSg)}</b>
            </p>
            <p className="text-ink-2">
              The shots add up to exactly that. But now you can see <i>why</i>.{' '}
              {good.length > 0 && (
                <>
                  The {good.map((s) => s.title.replace(/^The /, '').toLowerCase()).join(' and the ')}{' '}
                  {good.length === 1 ? 'was' : 'were'} better than scratch.{' '}
                </>
              )}
              {worst.length > 0 && (
                <>
                  The bogey came from the {worst.map((s) => `${s.title.replace(/^The /, '').toLowerCase()} (${fmt(s.sg)})`).join(' and the ')}.
                </>
              )}
            </p>
            <p className="text-ink-2">
              The scorecard just says &ldquo;5&rdquo;. Strokes gained says which shots to practise. The app scores every shot
              you log like this, then adds them up by area: off the tee, approach, short game, bunker, putting.
            </p>
          </>,
        )}
      </div>
    </div>
  );
}

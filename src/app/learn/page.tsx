import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { getAllEnrichedShots } from '@/lib/insights/queries';
import { roundSummaries } from '@/lib/insights/aggregate';
import { qualityStat, type QualityStat } from '@/lib/insights/quality';
import { buildTour } from '@/lib/learn/tour';
import { explainQuality, qualityLadder } from '@/lib/learn/explain';
import { MIN_TAGGED } from '@/lib/insights/dispersion';
import { LOGGING_STEPS } from '@/lib/learn/onboarding';
import { QualityBadge } from '../quality-badge';
import { SgTour } from './sg-tour';

export const dynamic = 'force-dynamic';

const TOPICS = [
  { id: 'strokes-gained', label: 'Strokes gained' },
  { id: 'logging', label: 'Logging a round' },
  { id: 'shot-quality', label: 'The hexagon' },
  { id: 'round-card', label: 'A round card' },
  { id: 'what-to-work-on', label: 'What to work on' },
  { id: 'where-you-miss', label: 'Where you miss' },
  { id: 'small-samples', label: 'Small samples' },
];

function Topic({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-3 border-t pt-8">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{kicker}</p>
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const example = (shots: number, sg: number): QualityStat => ({ quality: 100 + (100 * sg) / shots, shots, sg, thin: false });

export default async function LearnPage() {
  const user = await requirePageUser();
  const tour = buildTour();
  const shots = await getAllEnrichedShots(user.id);
  const latest = roundSummaries(shots).sort((a, b) => b.playedOn.localeCompare(a.playedOn) || b.roundId - a.roundId)[0];
  const latestStat = latest ? qualityStat(shots.filter((s) => s.roundId === latest.roundId)) : null;
  const ladder = qualityLadder(72);

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">Learn: how to read your numbers</h1>
        <p className="text-ink-2">
          Every number in this app comes from one idea: compare each shot with what a scratch golfer would do from the same
          spot. Start with the one-hole tour, then dip into whatever you&apos;re looking at.
        </p>
        <nav aria-label="Topics" className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="rounded-full border bg-card px-3 py-1 text-sm text-ink-2 hover:text-ink">
              {t.label}
            </a>
          ))}
          <Link href="/welcome?again=1" className="rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-sm text-ink-2 hover:text-ink">
            Welcome tour
          </Link>
        </nav>
      </header>

      <section id="strokes-gained" className="scroll-mt-28 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">The tour · 1 minute</p>
        <h2 className="text-xl font-semibold">Strokes gained, one shot at a time</h2>
        <p className="text-ink-2">
          A bogey, played shot by shot. Keep scrolling: each shot is drawn on the hole in <span className="font-medium text-pos">green</span> if
          it gained on a scratch golfer, <span className="font-medium text-neg">red</span> if it lost.
        </p>
        <SgTour tour={tour} />
      </section>

      <Topic id="logging" kicker="Logging a round" title="What every shot needs">
        <ol className="space-y-2">
          {LOGGING_STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-2 rounded-lg border bg-card p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-sm text-paper">{i + 1}</span>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="mt-0.5 text-sm text-ink-2">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>
            <b className="text-ink">Penalties:</b> tick &ldquo;Penalty on this shot&rdquo;, then lateral (enter where you dropped) or
            stroke and distance (replay from the same spot). The penalty stays with the shot that caused it.
          </li>
          <li>
            <b className="text-ink">Log on the course or after.</b> Swipe the hole card, or use the strip of hole numbers, to
            move between holes; the round resumes at the first unfinished hole.
          </li>
          <li>
            <b className="text-ink">Nothing is final:</b> Undo last shot, or Edit any shot from its hole. Later shots keep their
            results and start where the edited one finished.
          </li>
          <li>
            The round page also takes a <b className="text-ink">name, notes</b> (type, dictate, or paste a voice note) and three
            1–5 ratings for balance, tempo and tension. None of that changes strokes gained.
          </li>
        </ul>
      </Topic>

      <Topic id="shot-quality" kicker="The hexagon" title="Shot quality: 100 is scratch">
        <p className="text-ink-2">
          The hexagon on every round is your strokes gained <i>per shot</i>, scaled so a scratch golfer&apos;s average shot is
          100. Each point is a hundredth of a stroke:
        </p>
        <p className="rounded-lg border bg-paper p-3 font-mono text-sm">shot quality = 100 + 100 × (strokes gained ÷ shots)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { stat: example(68, 4), text: 'Gained 4 strokes over 68 shots. Better than scratch.' },
            { stat: example(72, 0), text: 'Level with scratch, shot for shot.' },
            { stat: example(79, -10.44), text: 'Lost 10.4 over 79 shots: about 0.13 a shot.' },
          ].map((x) => (
            <div key={x.stat.quality} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <QualityBadge stat={x.stat} />
              <p className="text-sm text-ink-2">{x.text}</p>
            </div>
          ))}
        </div>
        {latestStat && latest && (
          <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft p-3">
            <QualityBadge stat={latestStat} />
            <p className="text-sm text-ink-2">
              <b className="text-ink">Your latest round</b> ({latest.courseName}, {latest.playedOn}): {explainQuality(latestStat).headline}{' '}
              {explainQuality(latestStat).detail}
            </p>
          </div>
        )}
        <p className="text-ink-2">What a score works out to over a round of about 72 shots at scratch:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-1 font-normal">Score</th>
                <th className="font-normal">Strokes vs scratch</th>
                <th className="font-normal">Roughly</th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((r) => (
                <tr key={r.quality} className="border-t">
                  <td className="py-1 font-mono">{r.quality}</td>
                  <td className={`font-mono ${r.strokesPerRound > 0.05 ? 'text-neg' : r.strokesPerRound < -0.05 ? 'text-pos' : ''}`}>
                    {r.strokesPerRound > 0.05 ? `${r.strokesPerRound.toFixed(1)} lost` : r.strokesPerRound < -0.05 ? `${Math.abs(r.strokesPerRound).toFixed(1)} gained` : 'level'}
                  </td>
                  <td className="text-ink-2">{r.band}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>The outline is green above 100 and red below; exactly 100 is grey.</li>
          <li>
            It&apos;s per shot, so it says how <i>well</i> you hit the ball, not how many shots you needed. A nine-hole round
            is scored the same way as eighteen.
          </li>
          <li>A penalty stays with the shot that caused it, so an OB drive shows up as one very costly shot.</li>
          <li>A faded hexagon has fewer than 10 shots behind it: read it as a hint.</li>
          <li>Tap any hexagon for what that particular number means.</li>
        </ul>
      </Topic>

      <Topic id="round-card" kicker="The Rounds page" title="Reading a round card">
        <dl className="space-y-2 text-sm">
          {[
            ['Hexagon', 'Shot quality for the round (above).'],
            ['79 (+10 · par 69)', 'Your score, and how far over par.'],
            ['SG −10.44', 'Strokes gained for the round against a scratch golfer playing the same holes. Negative means scratch would have scored about that many better.'],
            ['Strongest / Work on', 'The areas (off the tee, approach, short game, bunker, putting, recovery) that gained the most and lost the most.'],
            ['Best / Worst hole', 'The holes with the best and worst strokes gained, not just the best and worst scores.'],
            ['GIR, putts, fairways…', 'The traditional stats, worked out from your shots.'],
            ['The coloured strip', 'Strokes gained in every area. They add up to the round total.'],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 rounded-lg border bg-card p-3">
              <dt className="font-medium">{k}</dt>
              <dd className="text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
      </Topic>

      <Topic id="what-to-work-on" kicker="Trends" title="What to work on">
        <p className="text-ink-2">
          On <Link href="/trends" className="underline underline-offset-2">Trends</Link>, every area of your game gets three
          numbers, and they&apos;re ranked by importance × opportunity:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>
            <b className="text-ink">Importance</b>: how much that kind of shot separates golfers&apos; scores, from Mark
            Broadie&apos;s <i>Every Shot Counts</i>. The long game (driving and approach) is about two-thirds of it.
          </li>
          <li>
            <b className="text-ink">Opportunity</b>: strokes a round you lose there against scratch, over your last 8 rounds.
          </li>
          <li>
            <b className="text-ink">Trend</b>: your recent rounds against the ones before, with a label for how much to trust it.
          </li>
        </ul>
      </Topic>

      <Topic id="where-you-miss" kicker="Insights" title="Where you miss, and Brief vs Detailed">
        <p className="text-ink-2">
          When you start a round you choose <b>Brief</b> (lie and distance only) or <b>Detailed</b>, which also asks where
          each shot missed (left, right, long, short) and each putt&apos;s slope and break. Brief keeps those inputs a tap
          away.
        </p>
        <p className="text-ink-2">
          The tags build <Link href="/insights" className="underline underline-offset-2">Insights</Link>&apos; &ldquo;Where you
          miss&rdquo; crosses and your putting profile. They never change strokes gained: they explain it.
        </p>
      </Topic>

      <Topic id="small-samples" kicker="Honesty" title="Small samples">
        <p className="text-ink-2">
          Three bunker shots can read like genius or disaster, and neither means much yet. So the app says when a number is
          thin: faded hexagons and bars under 10 shots, miss views under {MIN_TAGGED} tagged misses, and trends labelled{' '}
          <b>signal</b>, <b>limited data</b> or <b>too few shots</b>. The more rounds you log, the more of it firms up.
        </p>
      </Topic>
    </main>
  );
}

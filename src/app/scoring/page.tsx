import Link from 'next/link';
import { getAllEnrichedShots, getCourseOptions, getRoundDetailsById, getTeeHoleMeta } from '@/lib/insights/queries';
import { buildEclectic, buildRoundCard, parTypeStats, scoreDistribution } from '@/lib/insights/scorecard';
import { buildBenchmark, compareToBenchmark, type BenchmarkFile } from '@/lib/insights/benchmarks';
import scratchBenchmark from '@/lib/insights/benchmark-data/scratch.json';
import { roundSummaries } from '@/lib/insights/aggregate';
import { resolveSelectedCourseId } from '@/lib/insights/course-filter';
import { requirePageUser } from '@/lib/auth/session';
import { requestTimer } from '@/lib/timing';
import { CourseFilter } from '../course-filter';
import { Section } from '../section';
import { EclecticTable } from '../insights/eclectic-table';
import { ScoreDistributionChart } from '../insights/score-distribution';
import { ScoreHistory } from './score-history';
import { ParTypes } from './par-types';

export const dynamic = 'force-dynamic';

/**
 * Scoring: everything about the NUMBER on the card, split out of /insights (which is about
 * strokes gained). Score history covers every course; the sections below follow the course filter.
 */
export default async function ScoringPage({ searchParams }: { searchParams: Promise<{ course?: string | string[] }> }) {
  const timer = requestTimer('/scoring');
  const user = await timer.span('session', requirePageUser);
  const { course } = await searchParams;
  const [options, details, allShots] = await Promise.all([
    timer.span('options', () => getCourseOptions(user.id)),
    timer.span('details', () => getRoundDetailsById(user.id)),
    timer.span('shots', () => getAllEnrichedShots(user.id)),
  ]);
  const allRounds = roundSummaries(allShots);
  const teeMeta = await timer.span('teeMeta', () => getTeeHoleMeta(allRounds.map((r) => r.teeId)));
  timer.done(`shots=${allShots.length}`);

  const names = new Map([...details].map(([id, d]) => [id, d.name]));
  const selectedCourseId = resolveSelectedCourseId(options, Array.isArray(course) ? course[0] : course);
  const selected = options.find((o) => o.courseId === selectedCourseId);

  if (allRounds.length === 0) {
    return (
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Scoring</h1>
        <p className="text-ink-2">
          No rounds logged yet.{' '}
          <Link className="underline" href="/rounds/new">
            Log a round
          </Link>
          .
        </p>
      </main>
    );
  }

  const rounds = allRounds.filter((r) => r.courseId === selectedCourseId);
  const cards = rounds.map((r) => ({
    roundId: r.roundId,
    title: names.get(r.roundId) ?? `${r.courseName} — ${r.teeName}`,
    playedOn: r.playedOn,
    card: buildRoundCard(teeMeta.get(r.teeId) ?? [], allShots.filter((s) => s.roundId === r.roundId)),
  }));
  const distribution = scoreDistribution(cards.map((c) => c.card));
  const bench = buildBenchmark(scratchBenchmark as BenchmarkFile);
  const comparison = bench && distribution.holesPlayed > 0 ? compareToBenchmark(distribution, bench) : null;
  const parTypes = parTypeStats(cards.map((c) => c.card));
  const eclectic = buildEclectic(
    (teeMeta.get(rounds[0]?.teeId ?? -1) ?? []).map(({ holeNo, par }) => ({ holeNo, par })),
    cards,
  );

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Scoring</h1>

      <Section title="Score history" subtitle="Every round you've logged, on every course. Tap a round for its scorecard.">
        <ScoreHistory rounds={allRounds} names={names} />
      </Section>

      <div className="space-y-2">
        <CourseFilter options={options} selectedCourseId={selectedCourseId} basePath="/scoring" />
        <p className="text-sm text-muted">
          Below: {rounds.length} round{rounds.length === 1 ? '' : 's'} at {selected?.name}.
        </p>
      </div>

      <Section
        title="How your holes finish"
        subtitle={`Every one of the ${distribution.holesPlayed} holes you've finished here, by score to par, against scratch golfers. The ratios are how many pars (or better) you make for every bogey, and for every double or worse — higher is better.`}
      >
        <ScoreDistributionChart d={distribution} bench={bench} comparison={comparison} />
      </Section>

      <Section
        title="Par 3s, 4s and 5s"
        subtitle="Average score and strokes gained (vs scratch) by type of hole. Per round = per hole × how many of that par a round here has."
      >
        <ParTypes stats={parTypes} />
      </Section>

      <Section title="Eclectic scores" subtitle="Every round here, hole by hole — and the best and worst you've made on each. Tap a round for its scorecard.">
        <EclecticTable eclectic={eclectic} />
      </Section>
    </main>
  );
}

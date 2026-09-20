import {
  getAllEnrichedShots,
  getRoundCount,
  getCoursesWithRounds,
  getTeesWithRounds,
  getTeeHoleYardages,
} from '@/lib/insights/queries';
import { roundSummaries } from '@/lib/insights/aggregate';
import { categoryTrends, practicePriority, difficultyAdjustment } from '@/lib/insights/trends';
import { fmtSg } from '@/lib/insights/chart-colors';
import { DifficultyToggle, type AdjustableRound } from './difficulty-toggle';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  OFF_THE_TEE: 'Off the tee',
  APPROACH: 'Approach',
  SHORT_GAME: 'Short game',
  BUNKER: 'Bunker',
  PUTTING: 'Putting',
  RECOVERY: 'Recovery',
};

const SIGNAL_STYLE: Record<string, string> = {
  signal: 'bg-blue-100 text-blue-800',
  limited: 'bg-amber-100 text-amber-800',
  noise: 'bg-gray-100 text-gray-600',
};

const SIGNAL_LABEL: Record<string, string> = {
  signal: 'signal',
  limited: 'limited data',
  noise: 'noise — too few shots to read anything into this',
};

const MIN_ROUNDS_FOR_TREND = 4;

export default function TrendsPage() {
  const roundCount = getRoundCount();
  const shots = getAllEnrichedShots();

  if (roundCount === 0) {
    return (
      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-semibold mb-2">Trends &amp; practice focus</h1>
        <p className="text-gray-600">No rounds logged yet — nothing to trend.</p>
      </main>
    );
  }

  const trends = roundCount >= MIN_ROUNDS_FOR_TREND ? categoryTrends(shots, 3) : [];
  const priorities = practicePriority(shots, 4);

  const courses = getCoursesWithRounds();
  const tees = getTeesWithRounds();
  const summaries = roundSummaries(shots);

  const adjustableRounds: AdjustableRound[] = summaries.map((r) => {
    const tee = tees.find((t) => t.teeId === r.teeId);
    const holeYards = getTeeHoleYardages(r.teeId).map((h) => h.yards);
    const adj = tee ? difficultyAdjustment(r.teeId, tee.courseRating, holeYards) : { perHoleAdjustment: null };
    const holesPlayed = new Set(shots.filter((s) => s.roundId === r.roundId).map((s) => s.holeNo)).size;
    return {
      roundId: r.roundId,
      playedOn: r.playedOn,
      courseName: r.courseName,
      teeName: r.teeName,
      holesPlayed,
      sgTotal: r.sgTotal,
      perHoleAdjustment: adj.perHoleAdjustment,
    };
  });

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Trends &amp; practice focus</h1>
      <p className="text-sm text-gray-600">
        {roundCount} round{roundCount === 1 ? '' : 's'} logged
        {courses.length > 1 && (
          <span className="text-amber-700">
            {' '}
            across {courses.length} courses ({courses.map((c) => c.courseName).join(', ')}) — see the cross-course
            caveat below before comparing them directly.
          </span>
        )}
        .
      </p>

      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold text-lg">Trend — latest round vs. mean of prior 3</h2>
        {roundCount < MIN_ROUNDS_FOR_TREND ? (
          <p className="text-sm text-gray-600">
            Only {roundCount} round{roundCount === 1 ? '' : 's'} in the DB — trend comparisons need at least{' '}
            {MIN_ROUNDS_FOR_TREND} to be meaningful. Not drawing a trend line yet; log more rounds.
          </p>
        ) : trends.length === 0 ? (
          <p className="text-sm text-gray-600">No category has enough history yet to compare.</p>
        ) : (
          <ul className="space-y-2">
            {trends.map((t) => (
              <li key={t.category} className="flex items-center justify-between gap-3 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                <div>
                  <p className="font-medium">{CATEGORY_LABEL[t.category] ?? t.category}</p>
                  <p className="text-xs text-gray-500">
                    latest {fmtSg(t.latestSg)} ({t.latestShotCount} shots) vs. prior-3 avg {fmtSg(t.priorMeanSg)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${t.delta >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmtSg(t.delta)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${SIGNAL_STYLE[t.signal]}`}>{SIGNAL_LABEL[t.signal]}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold text-lg">Practice priority</h2>
        <p className="text-xs text-gray-500">
          Ranked by cumulative SG lost over the last 4 rounds, drilled down to the band — a stable signal worth
          acting on, independent of whether the trend above happens to be moving right now.
        </p>
        {priorities.length === 0 ? (
          <p className="text-sm text-gray-600">No net-negative band in the last {Math.min(4, roundCount)} round(s) — nothing to flag.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {priorities.slice(0, 8).map((p, i) => (
              <li key={p.label} className="flex justify-between border-t pt-1 first:border-t-0 first:pt-0">
                <span>
                  {i + 1}. {p.label}
                </span>
                <span className="text-red-600 font-medium">
                  {fmtSg(p.sgLost)} over {p.roundsCovered} round{p.roundsCovered === 1 ? '' : 's'} ({p.attempts} attempts)
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold text-lg">Cross-course difficulty adjustment</h2>
        <p className="text-xs text-gray-500">
          The baseline is length-only — it calibrates within ~0.25 strokes at Elm Park but understates a hard
          links course like Portmarnock by several shots, so raw SG there reads worse for identical golf. Off by
          default.
        </p>
        <DifficultyToggle rounds={adjustableRounds} />
      </section>
    </main>
  );
}

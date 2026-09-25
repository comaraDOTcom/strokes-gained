import {
  getAllEnrichedShots,
  getRoundCount,
  getCoursesWithRounds,
  getTeesWithRounds,
  getTeeHoleYardages,
} from '@/lib/insights/queries';
import { roundSummaries } from '@/lib/insights/aggregate';
import { categoryTrends, difficultyAdjustment } from '@/lib/insights/trends';
import { buildRoadmap } from '@/lib/insights/roadmap';
import { fmtSg } from '@/lib/insights/chart-colors';
import { requirePageUser } from '@/lib/auth/session';
import { DifficultyToggle, type AdjustableRound } from './difficulty-toggle';
import { buildPlayCalendar } from '@/lib/insights/calendar';
import { PlayCalendarGrid } from './play-calendar';
import { RoadmapSection } from './roadmap';
import { SignalChip } from './signal-chip';
import { QualityTrendsSection } from './quality-trends';
import { isoDaysBefore, qualityTrends } from '@/lib/insights/quality';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  OFF_THE_TEE: 'Off the tee',
  APPROACH: 'Approach',
  SHORT_GAME: 'Short game',
  BUNKER: 'Bunker',
  PUTTING: 'Putting',
  RECOVERY: 'Recovery',
};

const MIN_ROUNDS_FOR_TREND = 4;
const CALENDAR_DAYS = 90;

export default async function TrendsPage() {
  const user = await requirePageUser();
  const roundCount = await getRoundCount(user.id);
  const shots = await getAllEnrichedShots(user.id);

  if (roundCount === 0) {
    return (
      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-semibold mb-2">Trends &amp; practice focus</h1>
        <p className="text-ink-2">No rounds logged yet — nothing to trend.</p>
      </main>
    );
  }

  const trends = roundCount >= MIN_ROUNDS_FOR_TREND ? categoryTrends(shots, 3) : [];
  // Today in Irish time, so a Saturday evening round lands on Saturday's square.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin' }).format(new Date());
  const roadmap = buildRoadmap(shots);
  const quality = qualityTrends(shots, { since: isoDaysBefore(today, 365) });

  const [courses, tees] = await Promise.all([getCoursesWithRounds(user.id), getTeesWithRounds(user.id)]);
  const summaries = roundSummaries(shots);

  // One yardage query per distinct tee, not per round.
  const yardsByTee = new Map(
    await Promise.all(
      [...new Set(summaries.map((r) => r.teeId))].map(
        async (teeId) => [teeId, (await getTeeHoleYardages(teeId)).map((h) => h.yards)] as const,
      ),
    ),
  );

  const adjustableRounds: AdjustableRound[] = summaries.map((r) => {
    const tee = tees.find((t) => t.teeId === r.teeId);
    const holeYards = yardsByTee.get(r.teeId) ?? [];
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

  const calendar = buildPlayCalendar(
    summaries.map((r) => ({
      roundId: r.roundId,
      playedOn: r.playedOn,
      courseId: r.courseId,
      courseName: r.courseName,
      grossScore: r.grossScore,
      par: r.par,
      holesPlayed: r.holesPlayed,
    })),
    today,
    CALENDAR_DAYS,
  );

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Trends &amp; practice focus</h1>
      <p className="text-sm text-ink-2">
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

      <section className="border rounded-xl bg-card p-4 space-y-3">
        <h2 className="font-semibold text-lg">When you played</h2>
        <p className="text-xs text-muted">
          The last {CALENDAR_DAYS} days, a square a day, coloured by course. Tap a day to open that round.
        </p>
        <PlayCalendarGrid calendar={calendar} days={CALENDAR_DAYS} />
      </section>

      <QualityTrendsSection trends={quality} />

      <section className="border rounded-xl bg-card p-4 space-y-3">
        <h2 className="font-semibold text-lg">Trend — latest round vs. mean of prior 3</h2>
        {roundCount < MIN_ROUNDS_FOR_TREND ? (
          <p className="text-sm text-ink-2">
            Only {roundCount} round{roundCount === 1 ? '' : 's'} in the DB — trend comparisons need at least{' '}
            {MIN_ROUNDS_FOR_TREND} to be meaningful. Not drawing a trend line yet; log more rounds.
          </p>
        ) : trends.length === 0 ? (
          <p className="text-sm text-ink-2">No category has enough history yet to compare.</p>
        ) : (
          <ul className="space-y-2">
            {trends.map((t) => (
              <li key={t.category} className="flex items-center justify-between gap-3 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                <div>
                  <p className="font-medium">{CATEGORY_LABEL[t.category] ?? t.category}</p>
                  <p className="text-xs text-muted">
                    latest {fmtSg(t.latestSg)} ({t.latestShotCount} shots) vs. prior-3 avg {fmtSg(t.priorMeanSg)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${t.delta >= 0 ? 'text-pos' : 'text-neg'}`}>{fmtSg(t.delta)}</p>
                  <SignalChip signal={t.signal} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RoadmapSection roadmap={roadmap} />

      <section className="border rounded-xl bg-card p-4 space-y-3">
        <h2 className="font-semibold text-lg">Cross-course difficulty adjustment</h2>
        <p className="text-xs text-muted">
          The baseline is length-only — it calibrates within ~0.25 strokes at Elm Park but understates a hard
          links course like Portmarnock by several shots, so raw SG there reads worse for identical golf. Off by
          default.
        </p>
        <DifficultyToggle rounds={adjustableRounds} />
      </section>
    </main>
  );
}

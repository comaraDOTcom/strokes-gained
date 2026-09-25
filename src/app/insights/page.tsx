import Link from 'next/link';
import { getAllEnrichedShots, getCourseOptions, getRoundDetailsById } from '@/lib/insights/queries';
import { buildSgTable } from '@/lib/insights/sg-table';
import { SgRoundTable } from './sg-round-table';
import { buildCourseStory, drillArea } from '@/lib/insights/recap';
import { SG_TABLE_COLUMNS, drillKey } from '@/lib/insights/sg-table';
import { AreaCard, ShotGroupsBody, StoryHoleRow } from '../recap-parts';
import { requirePageUser } from '@/lib/auth/session';
import { requestTimer } from '@/lib/timing';
import { resolveSelectedCourseId } from '@/lib/insights/course-filter';
import {
  categorySeries,
  roundSummaries,
  rollingAverageByCategory,
  puttingBandStats,
  puttsPerRound,
  shortGameBandStats,
  shortGameLieStats,
  bunkerStats,
  approachBandStats,
  approachLieStats,
  girAndFairwayTrend,
  penaltyAndRecoveryByHole,
  upAndDownVsSandSaveTrend,
} from '@/lib/insights/aggregate';
import { fmtPct, fmtSg, CATEGORICAL } from '@/lib/insights/chart-colors';
import { CourseFilter } from '../course-filter';
import { Section } from '../section';
import { QualityBadge } from '../quality-badge';
import { QualityBars } from '../recap-parts';
import { roundQuality } from '@/lib/insights/quality';
import { DivergingBarChart, GroupedBarChart, TrendBarChart } from './charts';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  OFF_THE_TEE: 'Off the tee',
  APPROACH: 'Approach',
  SHORT_GAME: 'Short game',
  BUNKER: 'Bunker',
  PUTTING: 'Putting',
  RECOVERY: 'Recovery',
};

function ChartOrEmpty({ data, children }: { data: unknown[]; children: React.ReactNode }) {
  if (data.length === 0) {
    return <p className="text-sm text-faint py-4">No shots in this category yet.</p>;
  }
  return <>{children}</>;
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[]; area?: string | string[] }>;
}) {
  const timer = requestTimer('/insights');
  const user = await timer.span('session', requirePageUser);
  const { course, area } = await searchParams;
  // Two stages, each one parallel batch: what's needed to pick the course, then that course's data.
  const [options, details] = await Promise.all([
    timer.span('options', () => getCourseOptions(user.id)),
    timer.span('details', () => getRoundDetailsById(user.id)),
  ]);
  const selectedCourseId = resolveSelectedCourseId(options, Array.isArray(course) ? course[0] : course);
  const selected = options.find((o) => o.courseId === selectedCourseId);
  const roundCount = selected?.roundCount ?? 0;
  const shots = selectedCourseId === null ? [] : await timer.span('shots', () => getAllEnrichedShots(user.id, selectedCourseId));

  if (roundCount === 0) {
    return (
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <CourseFilter options={options} selectedCourseId={selectedCourseId} basePath="/insights" />
        <p className="text-ink-2">
          No rounds logged yet{selected ? ` at ${selected.name}` : ''}.{' '}
          <Link className="underline" href="/rounds/new">
            Log a round
          </Link>
          .
        </p>
      </main>
    );
  }

  const series = categorySeries(shots);
  const story = buildCourseStory(shots);
  const quality = roundQuality(shots);

  const summaries = roundSummaries(shots);
  const roundNames = new Map([...details].map(([id, d]) => [id, d.name]));
  const sgTable = buildSgTable(summaries, roundNames);
  // Every round × area drill-down, worked out here (a few shots each) so tapping a number in the
  // table opens it instantly in the browser. `?area=<roundId>.<CATEGORY>` says which starts open.
  const drills = Object.fromEntries(
    summaries.flatMap((r) =>
      SG_TABLE_COLUMNS.filter((c) => shots.some((s) => s.roundId === r.roundId && s.category === c.key)).map((c) => [
        drillKey(r.roundId, c.key),
        drillArea(shots, r.roundId, c.key),
      ]),
    ),
  );
  const openArea = (Array.isArray(area) ? area[0] : area) ?? null;
  const rolling = rollingAverageByCategory(series, 3);

  const puttingBands = puttingBandStats(shots);
  const putts = puttsPerRound(shots);
  const shortGameBands = shortGameBandStats(shots);
  const shortGameLies = shortGameLieStats(shots);
  const bunker = bunkerStats(shots);
  const approachBands = approachBandStats(shots);
  const approachLies = approachLieStats(shots);
  const girFairwayTrend = girAndFairwayTrend(shots);
  const holeLosses = penaltyAndRecoveryByHole(shots);
  const upDownTrend = upAndDownVsSandSaveTrend(shots);

  timer.done(`shots=${shots.length}`);

  const categoriesInOrder = ['OFF_THE_TEE', 'APPROACH', 'SHORT_GAME', 'BUNKER', 'PUTTING', 'RECOVERY'];
  const rollingByCategory = categoriesInOrder
    .map((cat) => ({ cat, points: rolling.filter((r) => r.category === cat) }))
    .filter((c) => c.points.length > 0);

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <CourseFilter options={options} selectedCourseId={selectedCourseId} basePath="/insights" />
      <p className="text-sm text-muted">
        {roundCount} round{roundCount === 1 ? '' : 's'} logged at {selected?.name}.
      </p>

      <Section
        title="Your story so far"
        subtitle={`Across ${story.rounds} round${story.rounds === 1 ? '' : 's'} (${story.holesPlayed} holes) here — ${fmtSg(story.sgPer18)} strokes gained per 18 holes vs. a scratch golfer.`}
      >
        {story.strongArea && story.weakArea && (
          <div className="grid gap-3 sm:grid-cols-2">
            <AreaCard
              a={story.strongArea}
              per18={story.strongArea.per18}
              tone={story.strongArea.sg >= 0 ? 'pos' : 'neg'}
              kicker={story.strongArea.sg >= 0 ? 'Strongest area' : 'Holding up best'}
            />
            <AreaCard a={story.weakArea} per18={story.weakArea.per18} tone="neg" kicker="Work on this" />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-semibold">Holes you play best</h3>
            <ul className="space-y-2">{story.bestHoles.map((h) => <StoryHoleRow key={h.holeNo} h={h} />)}</ul>
          </div>
          {story.worstHoles.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Holes that cost you most</h3>
              <ul className="space-y-2">{story.worstHoles.map((h) => <StoryHoleRow key={h.holeNo} h={h} />)}</ul>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-semibold">Best shots</h3>
            <ShotGroupsBody groups={story.bestShots} showDate={story.rounds > 1} />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Worst shots</h3>
            <ShotGroupsBody groups={story.worstShots} showDate={story.rounds > 1} />
          </div>
        </div>
      </Section>

      {quality.overall && (
        <Section
          title="Shot quality"
          subtitle="Strokes gained per shot, scaled so 100 is a scratch golfer's average shot. Unlike the totals, it doesn't depend on how many of each shot you hit."
        >
          <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center">
              <QualityBadge stat={quality.overall} size="lg" />
              <p className="mt-1 text-center font-mono text-[11px] text-muted">
                {story.rounds} round{story.rounds === 1 ? '' : 's'}, {quality.overall.shots} shots
              </p>
            </div>
            <QualityBars areas={quality.byCategory} />
          </div>
          <p className="text-xs text-muted">Faded rows have fewer than 10 shots, so read them as a hint.</p>
        </Section>
      )}

      <p className="text-sm text-ink-2">
        Scores, how your holes finish vs scratch golfers, par 3s/4s/5s and your eclectic are on{' '}
        <Link className="underline" href={`/scoring?course=${selectedCourseId}`}>
          Scoring
        </Link>
        .
      </p>

      <Section
        title="Strokes gained"
        subtitle="Where your strokes go, discipline by discipline, against a scratch golfer: green = gained, red = lost. Tap any number to see the shots behind it; hover for two decimals."
      >
        <SgRoundTable table={sgTable} drills={drills} initialOpen={openArea} />
      </Section>

      <Section title="SG per round over time" subtitle="Each round's strokes gained per category, with the 3-round average dashed on top">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rollingByCategory.map(({ cat, points }) => (
            <div key={cat}>
              <p className="text-sm font-medium mb-1">{CATEGORY_LABEL[cat] ?? cat}</p>
              <TrendBarChart
                data={points.map((p) => ({ round: p.playedOn, sg: Number(p.sg.toFixed(3)), rolling: Number(p.rollingAvg.toFixed(3)) }))}
                xKey="round"
                valueKey="sg"
                rollingKey="rolling"
                rollingLabel="3-round average"
                height={180}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Putting" subtitle="SG and make% by distance band, vs. an implied baseline make%">
        <p className="text-xs text-muted">
          The baseline table only encodes expected strokes, not a make-percentage table, so "baseline" here is
          <em> implied</em> from it (2 − expected strokes, i.e. the make rate a hole-or-2-putt model implies) — a
          derived comparator, not a separately sourced statistic.
        </p>
        <DivergingBarChart
          data={puttingBands.map((b) => ({ band: b.band, sgPerPutt: Number(b.sgPerPutt.toFixed(3)) }))}
          xKey="band"
          yKey="sgPerPutt"
          suffix="/ putt"
          digits={2}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs">
              <th className="py-1">Band</th>
              <th className="py-1">Attempts</th>
              <th className="py-1">Make%</th>
              <th className="py-1">Implied baseline</th>
            </tr>
          </thead>
          <tbody>
            {puttingBands.map((b) => (
              <tr key={b.band} className="border-t">
                <td className="py-1">{b.band}</td>
                <td className="py-1">{b.attempts}</td>
                <td className="py-1">{fmtPct(b.makePct)}</td>
                <td className="py-1 text-muted">{fmtPct(b.impliedBaselineMakePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm font-medium mt-2">Putts per round</p>
        <TrendBarChart
          data={putts.map((p) => ({ round: p.playedOn, putts: p.putts }))}
          xKey="round"
          valueKey="putts"
          height={180}
          format="plain"
        />
      </Section>

      <Section title="Short game" subtitle="Shots ≤30y, not on the green, not sand — by band and by lie">
        <p className="text-sm font-medium mb-1">By band</p>
        <ChartOrEmpty data={shortGameBands}>
          <DivergingBarChart
            data={shortGameBands.map((b) => ({ band: b.band, sgPerShot: Number(b.sgPerShot.toFixed(3)) }))}
            xKey="band"
            yKey="sgPerShot"
            suffix="/ shot"
            digits={2}
            height={180}
          />
        </ChartOrEmpty>
        <p className="text-sm font-medium mb-1 mt-3">By lie</p>
        <ChartOrEmpty data={shortGameLies}>
          <DivergingBarChart
            data={shortGameLies.map((l) => ({ lie: l.lie, sgPerShot: Number(l.sgPerShot.toFixed(3)) }))}
            xKey="lie"
            yKey="sgPerShot"
            suffix="/ shot"
            digits={2}
            height={180}
          />
        </ChartOrEmpty>
      </Section>

      <Section title="Bunker" subtitle="Greenside (≤30y) vs. fairway (>30y) — deliberately its own category, not folded into approach">
        <ChartOrEmpty data={bunker}>
          <DivergingBarChart
            data={bunker.map((b) => ({ subtype: b.subtype, sgPerShot: Number(b.sgPerShot.toFixed(3)) }))}
            xKey="subtype"
            yKey="sgPerShot"
            suffix="/ shot"
            digits={2}
            height={180}
          />
        </ChartOrEmpty>
        <p className="text-sm text-ink-2">Sand save %: see the up-and-down/sand-save trend below.</p>
      </Section>

      <Section title="Approach" subtitle="By band and by starting lie, plus GIR% and fairways-hit% trend">
        <p className="text-sm font-medium mb-1">By band</p>
        <ChartOrEmpty data={approachBands}>
          <DivergingBarChart
            data={approachBands.map((b) => ({ band: b.band, sgPerShot: Number(b.sgPerShot.toFixed(3)) }))}
            xKey="band"
            yKey="sgPerShot"
            suffix="/ shot"
            digits={2}
            height={180}
          />
        </ChartOrEmpty>
        <p className="text-sm font-medium mb-1 mt-3">By start lie</p>
        <ChartOrEmpty data={approachLies}>
          <DivergingBarChart
            data={approachLies.map((l) => ({ lie: l.lie, sgPerShot: Number(l.sgPerShot.toFixed(3)) }))}
            xKey="lie"
            yKey="sgPerShot"
            suffix="/ shot"
            digits={2}
            height={180}
          />
        </ChartOrEmpty>
        <p className="text-sm font-medium mb-1 mt-3">GIR% and fairways-hit% trend</p>
        <GroupedBarChart
          data={girFairwayTrend.map((t) => ({
            round: t.playedOn,
            'GIR%': Math.round(t.girPct * 100),
            'Fairways%': t.fairwaysPct !== null ? Math.round(t.fairwaysPct * 100) : 0,
          }))}
          xKey="round"
          series={[
            { key: 'GIR%', label: 'GIR%', color: CATEGORICAL[0] },
            { key: 'Fairways%', label: 'Fairways%', color: CATEGORICAL[1] },
          ]}
          format="percent"
          domain={[0, 100]}
          height={180}
        />
      </Section>

      <Section title="Strokes lost to penalties and recovery" subtitle="By hole">
        {holeLosses.length === 0 ? (
          <p className="text-sm text-muted">No penalties or recovery shots logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-faint text-xs">
                <th className="py-1">Hole</th>
                <th className="py-1">Course</th>
                <th className="py-1">Penalty strokes</th>
                <th className="py-1">SG on recovery shots</th>
              </tr>
            </thead>
            <tbody>
              {holeLosses.map((h) => (
                <tr key={`${h.courseName}-${h.holeNo}`} className="border-t">
                  <td className="py-1">{h.holeNo}</td>
                  <td className="py-1">{h.courseName}</td>
                  <td className="py-1 text-neg">{h.penaltyStrokes > 0 ? h.penaltyStrokes : '—'}</td>
                  <td className={`py-1 ${h.recoverySgLost < 0 ? 'text-neg' : 'text-pos'}`}>
                    {h.recoveryShotCount > 0 ? `${fmtSg(h.recoverySgLost)} (${h.recoveryShotCount} shot${h.recoveryShotCount === 1 ? '' : 's'})` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Up-and-down % vs. sand-save %" subtitle="Sand save is the subset of up-and-down attempts that started in sand — related, not the same stat">
        <GroupedBarChart
          data={upDownTrend.map((t) => ({
            round: t.playedOn,
            'Up & down %': t.upAndDownPct !== null ? Math.round(t.upAndDownPct * 100) : 0,
            'Sand save %': t.sandSavePct !== null ? Math.round(t.sandSavePct * 100) : 0,
          }))}
          xKey="round"
          series={[
            { key: 'Up & down %', label: 'Up & down %', color: CATEGORICAL[0] },
            { key: 'Sand save %', label: 'Sand save %', color: CATEGORICAL[6] },
          ]}
          format="percent"
          domain={[0, 100]}
        />
      </Section>
    </main>
  );
}

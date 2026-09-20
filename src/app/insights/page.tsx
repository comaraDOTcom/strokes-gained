import { getAllEnrichedShots, getRoundCount } from '@/lib/insights/queries';
import {
  categorySeries,
  latestVsPriorMean,
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
import { DivergingBarChart, GroupedBarChart, TrendLineChart } from './charts';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  OFF_THE_TEE: 'Off the tee',
  APPROACH: 'Approach',
  SHORT_GAME: 'Short game',
  BUNKER: 'Bunker',
  PUTTING: 'Putting',
  RECOVERY: 'Recovery',
};

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="border rounded p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function InsightsPage() {
  const roundCount = getRoundCount();
  const shots = getAllEnrichedShots();

  if (roundCount === 0) {
    return (
      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-semibold mb-2">Insights</h1>
        <p className="text-gray-600">No rounds logged yet — nothing to break down.</p>
      </main>
    );
  }

  const series = categorySeries(shots);
  const comparison = latestVsPriorMean(series, 3);
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

  const categoriesInOrder = ['OFF_THE_TEE', 'APPROACH', 'SHORT_GAME', 'BUNKER', 'PUTTING', 'RECOVERY'];
  const rollingByCategory = categoriesInOrder
    .map((cat) => ({ cat, points: rolling.filter((r) => r.category === cat) }))
    .filter((c) => c.points.length > 0);

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <p className="text-sm text-gray-500">
        {roundCount} round{roundCount === 1 ? '' : 's'} logged.
      </p>

      <Section title="SG by category" subtitle="Latest round vs. mean of the prior 3 rounds">
        {comparison.length === 0 ? (
          <p className="text-sm text-gray-500">Needs at least 2 rounds in the same category to compare.</p>
        ) : (
          <GroupedBarChart
            data={comparison.map((c) => ({
              category: CATEGORY_LABEL[c.category] ?? c.category,
              'Prior 3 avg': Number(c.priorMeanSg.toFixed(3)),
              Latest: Number(c.latestSg.toFixed(3)),
            }))}
            xKey="category"
            series={[
              { key: 'Prior 3 avg', label: 'Prior 3 avg', color: CATEGORICAL[2] },
              { key: 'Latest', label: 'Latest round', color: CATEGORICAL[0] },
            ]}
            valueFormatter={(v) => fmtSg(v)}
          />
        )}
      </Section>

      <Section title="SG per round over time" subtitle="3-round rolling average, per category">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rollingByCategory.map(({ cat, points }) => (
            <div key={cat}>
              <p className="text-sm font-medium mb-1">{CATEGORY_LABEL[cat] ?? cat}</p>
              <TrendLineChart
                data={points.map((p) => ({ round: p.playedOn, sg: Number(p.sg.toFixed(3)), rolling: Number(p.rollingAvg.toFixed(3)) }))}
                xKey="round"
                valueKey="sg"
                rollingKey="rolling"
                height={140}
                valueFormatter={(v) => fmtSg(v)}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Putting" subtitle="SG and make% by distance band, vs. an implied baseline make%">
        <p className="text-xs text-gray-500">
          The baseline table only encodes expected strokes, not a make-percentage table, so "baseline" here is
          <em> implied</em> from it (2 − expected strokes, i.e. the make rate a hole-or-2-putt model implies) — a
          derived comparator, not a separately sourced statistic.
        </p>
        <DivergingBarChart
          data={puttingBands.map((b) => ({ band: b.band, sgPerPutt: Number(b.sgPerPutt.toFixed(3)) }))}
          xKey="band"
          yKey="sgPerPutt"
          valueFormatter={(v) => `${fmtSg(v)} / putt`}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs">
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
                <td className="py-1 text-gray-500">{fmtPct(b.impliedBaselineMakePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm font-medium mt-2">Putts per round</p>
        <TrendLineChart
          data={putts.map((p) => ({ round: p.playedOn, putts: p.putts }))}
          xKey="round"
          valueKey="putts"
          height={140}
          valueFormatter={(v) => `${v}`}
        />
      </Section>

      <Section title="Short game" subtitle="Shots ≤30y, not on the green, not sand — by band and by lie">
        <p className="text-sm font-medium mb-1">By band</p>
        <DivergingBarChart
          data={shortGameBands.map((b) => ({ band: b.band, sgPerShot: Number(b.sgPerShot.toFixed(3)) }))}
          xKey="band"
          yKey="sgPerShot"
          valueFormatter={(v) => `${fmtSg(v)} / shot`}
          height={180}
        />
        <p className="text-sm font-medium mb-1 mt-3">By lie</p>
        <DivergingBarChart
          data={shortGameLies.map((l) => ({ lie: l.lie, sgPerShot: Number(l.sgPerShot.toFixed(3)) }))}
          xKey="lie"
          yKey="sgPerShot"
          valueFormatter={(v) => `${fmtSg(v)} / shot`}
          height={180}
        />
      </Section>

      <Section title="Bunker" subtitle="Greenside (≤30y) vs. fairway (>30y) — deliberately its own category, not folded into approach">
        <DivergingBarChart
          data={bunker.map((b) => ({ subtype: b.subtype, sgPerShot: Number(b.sgPerShot.toFixed(3)) }))}
          xKey="subtype"
          yKey="sgPerShot"
          valueFormatter={(v) => `${fmtSg(v)} / shot`}
          height={180}
        />
        <p className="text-sm text-gray-600">Sand save %: see the up-and-down/sand-save trend below.</p>
      </Section>

      <Section title="Approach" subtitle="By band and by starting lie, plus GIR% and fairways-hit% trend">
        <p className="text-sm font-medium mb-1">By band</p>
        <DivergingBarChart
          data={approachBands.map((b) => ({ band: b.band, sgPerShot: Number(b.sgPerShot.toFixed(3)) }))}
          xKey="band"
          yKey="sgPerShot"
          valueFormatter={(v) => `${fmtSg(v)} / shot`}
          height={180}
        />
        <p className="text-sm font-medium mb-1 mt-3">By start lie</p>
        <DivergingBarChart
          data={approachLies.map((l) => ({ lie: l.lie, sgPerShot: Number(l.sgPerShot.toFixed(3)) }))}
          xKey="lie"
          yKey="sgPerShot"
          valueFormatter={(v) => `${fmtSg(v)} / shot`}
          height={180}
        />
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
          valueFormatter={(v) => `${v}%`}
          height={180}
        />
      </Section>

      <Section title="Strokes lost to penalties and recovery" subtitle="By hole">
        {holeLosses.length === 0 ? (
          <p className="text-sm text-gray-500">No penalties or recovery shots logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs">
                <th className="py-1">Hole</th>
                <th className="py-1">Course</th>
                <th className="py-1">Penalty strokes</th>
                <th className="py-1">SG lost to recovery</th>
              </tr>
            </thead>
            <tbody>
              {holeLosses.map((h) => (
                <tr key={`${h.courseName}-${h.holeNo}`} className="border-t">
                  <td className="py-1">{h.holeNo}</td>
                  <td className="py-1">{h.courseName}</td>
                  <td className="py-1 text-red-600">{h.penaltyStrokes > 0 ? h.penaltyStrokes : '—'}</td>
                  <td className="py-1 text-red-600">
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
          valueFormatter={(v) => `${v}%`}
        />
      </Section>
    </main>
  );
}

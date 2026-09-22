import type { ScoreDistribution, ScoreTone } from '@/lib/insights/scorecard';
import { BENCHMARK_LABEL, headlineGap, strokesPerRound, type Benchmark, type BenchmarkBucket, type BucketComparison } from '@/lib/insights/benchmarks';
import { toneFillClass } from '../score-cell';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ratio = (x: number | null) => (x === null ? '—' : `${x.toFixed(1)} : 1`);

function Ratio({ label, value, detail, scratch }: { label: string; value: number | null; detail: string; scratch?: number | null }) {
  return (
    <div className="rounded-lg border bg-paper px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-2xl font-medium">{ratio(value)}</p>
      <p className="text-xs text-muted">{detail}</p>
      {scratch !== undefined && (
        <p className="mt-1 border-t pt-1 font-mono text-xs text-ink-2">
          Scratch <span className="font-medium text-ink">{ratio(scratch)}</span>
        </p>
      )}
    </div>
  );
}

const TONE: Record<BenchmarkBucket, ScoreTone> = { eagle: 'eagle', birdie: 'birdie', par: 'par', bogey: 'bogey', doublePlus: 'double' };

/**
 * Yours vs scratch, five buckets: your bar, a faint strip for the scratch players' spread, and a
 * dark tick at the scratch average.
 */
function BenchmarkBars({ rows, bench, triples }: { rows: BucketComparison[]; bench: Benchmark; triples: number }) {
  const max = Math.max(...rows.map((r) => Math.max(r.mine, bench.range[r.bucket].max)), 0.01);
  const x = (v: number) => `${(v / max) * 100}%`;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const band = bench.range[r.bucket];
        return (
          <li key={r.bucket} className="grid grid-cols-[4.5rem_minmax(0,1fr)_6.5rem] items-center gap-2 text-sm">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{BENCHMARK_LABEL[r.bucket]}</span>
            <span className="relative block h-6 border-l border-line-strong">
              <span className="absolute inset-y-0 bg-ink/10" style={{ left: x(band.min), width: `calc(${x(band.max)} - ${x(band.min)})` }} />
              <span
                className={`absolute inset-y-1 left-0 rounded-r-sm ring-1 ring-inset ring-ink/10 ${toneFillClass(TONE[r.bucket])}`}
                style={{ width: x(r.mine) }}
              />
              <span className="absolute -inset-y-0.5 w-0.5 bg-ink" style={{ left: x(r.bench) }} title={`Scratch ${pct(r.bench)}`} />
            </span>
            <span className="text-right font-mono text-xs">
              <span className="font-medium">{pct(r.mine)}</span> <span className="text-muted">· scratch {pct(r.bench)}</span>
              {r.bucket === 'doublePlus' && triples > 0 && <span className="block text-[10px] text-faint">{triples} triple or worse</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const GAP_WORDS: Record<string, [string, string]> = {
  eagle: ['More eagles', 'Fewer eagles'],
  birdie: ['More birdies', 'Fewer birdies'],
  bogey: ['More bogeys', 'Fewer bogeys'],
  doublePlus: ['More doubles or worse', 'Fewer doubles or worse'],
};

/** What each gap to scratch is worth in strokes per 18 holes — red where it costs you. */
function StrokeCost({ comparison }: { comparison: BucketComparison[] }) {
  const { gaps, total } = strokesPerRound(comparison);
  const shown = gaps.filter((g) => Math.abs(g.strokesPerRound) >= 0.05);
  if (shown.length === 0) return null;
  const fmt = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;
  return (
    <div className="space-y-2 rounded-lg border bg-paper p-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">What it costs you per round vs scratch</p>
      <ul className="space-y-1 text-sm">
        {shown
          .sort((a, b) => b.strokesPerRound - a.strokesPerRound)
          .map((g) => {
            const idx = comparison.find((c) => c.bucket === g.bucket)!.diff > 0 ? 0 : 1;
            return (
              <li key={g.bucket} className="flex items-baseline justify-between gap-3">
                <span className="text-ink-2">{GAP_WORDS[g.bucket]![idx]}</span>
                <span className={`font-mono tabular-nums ${g.strokesPerRound > 0 ? 'text-neg' : 'text-pos'}`}>
                  {fmt(g.strokesPerRound)}
                  {g.bucket === 'doublePlus' && g.strokesPerRound > 0 ? '+' : ''} strokes
                </span>
              </li>
            );
          })}
      </ul>
      <p className="flex items-baseline justify-between gap-3 border-t pt-2 text-sm font-medium">
        <span>{total >= 0 ? 'Behind scratch on how holes finish' : 'Ahead of scratch on how holes finish'}</span>
        <span className={`font-mono tabular-nums ${total > 0 ? 'text-neg' : 'text-pos'}`}>≈ {Math.abs(total).toFixed(1)} a round</span>
      </p>
      <p className="text-[11px] text-muted">
        18 holes × the gap in each share × what that score is worth to par. A double or worse is counted as +2, so its cost is
        at least this. Missed pars aren&apos;t listed: they show up as the bogeys and doubles they became.
      </p>
    </div>
  );
}

/** Share of every hole played that finished eagle-or-better … triple-or-worse, plus the two ratios that matter. */
export function ScoreDistributionChart({
  d,
  bench = null,
  comparison = null,
}: {
  d: ScoreDistribution;
  /** Scratch benchmark and your comparison against it; both null = no benchmark yet. */
  bench?: Benchmark | null;
  comparison?: BucketComparison[] | null;
}) {
  if (d.holesPlayed === 0) return <p className="py-4 text-sm text-faint">No finished holes yet.</p>;
  const max = Math.max(...d.buckets.map((b) => b.pct));
  const headline = comparison ? headlineGap(comparison) : null;
  const triples = d.buckets.find((b) => b.key === 'worse')?.count ?? 0;
  return (
    <div className="space-y-4">
      {headline && <p className="text-base font-medium">{headline.text}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Ratio
          label="Par or better : bogey"
          value={d.parToBogey}
          detail={`${d.parOrBetter} par or better, ${d.bogeys} bogey${d.bogeys === 1 ? '' : 's'}`}
          scratch={bench ? bench.parOrBetterToBogey : undefined}
        />
        <Ratio
          label="Par or better : double+"
          value={d.parToDoublePlus}
          detail={`${d.parOrBetter} par or better, ${d.doubleOrWorse} double or worse`}
          scratch={bench ? bench.parOrBetterToDoublePlus : undefined}
        />
      </div>
      {bench && comparison ? (
        <>
          <BenchmarkBars rows={comparison} bench={bench} triples={triples} />
          <StrokeCost comparison={comparison} />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-0.5 bg-ink" /> scratch average
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-4 bg-ink/10" /> scratch range
            </span>
            <span>
              Scratch = {bench.players} scratch-or-better golfers, {bench.rounds} competition rounds ({bench.holes} holes). A small
              sample from their home course: a guide, not a verdict.
            </span>
          </p>
        </>
      ) : (
        <ul className="space-y-1.5">
          {d.buckets.map((b) => (
            <li key={b.key} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-2 text-sm">
              <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{b.label}</span>
              <span className="h-5 border-l border-line-strong">
                <span
                  className={`block h-full rounded-r-sm ring-1 ring-inset ring-ink/10 ${toneFillClass(b.key)}`}
                  style={{ width: max ? `${(b.pct / max) * 100}%` : 0 }}
                />
              </span>
              <span className="text-right font-mono text-xs">
                {pct(b.pct)} <span className="text-faint">({b.count})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

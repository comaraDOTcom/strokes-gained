/**
 * Score-distribution BENCHMARKS: how often a cohort (e.g. scratch golfers) makes eagle, birdie,
 * par, bogey and double-or-worse, so "How your holes finish" can show yours against theirs. Pure.
 *
 * Source data is transcribed by hand from other golfers' round histories (see
 * docs/benchmarks.md) and is ANONYMISED before it reaches the repo: each player is a letter,
 * with no name, club or dates — only hole counts per bucket.
 *
 * Five buckets, not our six: the source apps report "double bogey or worse" as one number, so
 * our double and triple+ are merged when comparing.
 */
import type { ScoreDistribution } from './scorecard';

export const BENCHMARK_BUCKETS = ['eagle', 'birdie', 'par', 'bogey', 'doublePlus'] as const;
export type BenchmarkBucket = (typeof BENCHMARK_BUCKETS)[number];

export const BENCHMARK_LABEL: Record<BenchmarkBucket, string> = {
  eagle: 'Eagle+',
  birdie: 'Birdie',
  par: 'Par',
  bogey: 'Bogey',
  doublePlus: 'Double+',
};

/**
 * One anonymised player: how many holes they finished in each bucket, over `rounds` rounds.
 * A hole with no score in the source ("–", a pick-up) is transcribed as a TRIPLE BOGEY, so it lands
 * in double+. `unrecorded` is only for holes genuinely missing from the source (e.g. a round cut
 * short); with it the totals are checked exactly: holes + unrecorded = rounds × 18.
 */
export type BenchmarkPlayer = { id: string; rounds: number; unrecorded?: number; holes: Record<BenchmarkBucket, number> };
export type BenchmarkFile = { cohort: string; description: string; players: BenchmarkPlayer[] };

export type BucketShares = Record<BenchmarkBucket, number>;

export type Benchmark = {
  cohort: string;
  players: number;
  rounds: number;
  holes: number;
  /** Every player's holes pooled: each HOLE counts once (players with more rounds weigh more). */
  pooled: BucketShares;
  /** The spread between players, per bucket — the band a scratch golfer typically sits in. */
  range: Record<BenchmarkBucket, { min: number; max: number }>;
  parOrBetterToBogey: number | null;
  parOrBetterToDoublePlus: number | null;
};

const total = (h: Record<BenchmarkBucket, number>) => BENCHMARK_BUCKETS.reduce((a, b) => a + h[b], 0);
const shares = (h: Record<BenchmarkBucket, number>): BucketShares => {
  const n = total(h);
  return Object.fromEntries(BENCHMARK_BUCKETS.map((b) => [b, n ? h[b] / n : 0])) as BucketShares;
};
const ratio = (num: number, den: number) => (den ? num / den : null);

/** Problems with a transcribed file, in plain words; empty when it's usable. */
export function validateBenchmark(file: BenchmarkFile): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const p of file.players) {
    if (ids.has(p.id)) errors.push(`Player ${p.id} appears twice`);
    ids.add(p.id);
    if (!/^[A-Z]$/.test(p.id)) errors.push(`Player id "${p.id}" should be a single letter — no names`);
    for (const b of BENCHMARK_BUCKETS) {
      const v = p.holes[b];
      if (!Number.isInteger(v) || v < 0) errors.push(`Player ${p.id}: ${BENCHMARK_LABEL[b]} must be a whole number ≥ 0`);
    }
    const n = total(p.holes);
    if (p.unrecorded !== undefined) {
      if (n + p.unrecorded !== p.rounds * 18)
        errors.push(`Player ${p.id}: ${n} holes + ${p.unrecorded} unrecorded ≠ ${p.rounds} rounds × 18 — check the transcription`);
    } else {
      if (p.rounds > 0 && n > p.rounds * 18) errors.push(`Player ${p.id}: ${n} holes is more than ${p.rounds} rounds allow`);
      if (p.rounds > 0 && n < p.rounds * 9) errors.push(`Player ${p.id}: only ${n} holes for ${p.rounds} rounds — check the transcription`);
    }
  }
  return errors;
}

export function buildBenchmark(file: BenchmarkFile): Benchmark | null {
  if (file.players.length === 0) return null;
  const sum = Object.fromEntries(
    BENCHMARK_BUCKETS.map((b) => [b, file.players.reduce((a, p) => a + p.holes[b], 0)]),
  ) as Record<BenchmarkBucket, number>;
  const perPlayer = file.players.map((p) => shares(p.holes));
  const pob = sum.eagle + sum.birdie + sum.par;
  return {
    cohort: file.cohort,
    players: file.players.length,
    rounds: file.players.reduce((a, p) => a + p.rounds, 0),
    holes: total(sum),
    pooled: shares(sum),
    range: Object.fromEntries(
      BENCHMARK_BUCKETS.map((b) => [b, { min: Math.min(...perPlayer.map((s) => s[b])), max: Math.max(...perPlayer.map((s) => s[b])) }]),
    ) as Benchmark['range'],
    parOrBetterToBogey: ratio(pob, sum.bogey),
    parOrBetterToDoublePlus: ratio(pob, sum.doublePlus),
  };
}

/** Our six-bucket distribution folded into the benchmark's five (double + triple+ → double+). */
export function toBenchmarkBuckets(d: ScoreDistribution): Record<BenchmarkBucket, number> {
  const c = (k: string) => d.buckets.find((b) => b.key === k)?.count ?? 0;
  return { eagle: c('eagle'), birdie: c('birdie'), par: c('par'), bogey: c('bogey'), doublePlus: c('double') + c('worse') };
}

export type BucketComparison = { bucket: BenchmarkBucket; label: string; mine: number; bench: number; diff: number; inRange: boolean };

/** Yours vs the benchmark, bucket by bucket (shares 0–1; `diff` = mine − bench). */
export function compareToBenchmark(d: ScoreDistribution, bench: Benchmark): BucketComparison[] {
  const mine = shares(toBenchmarkBuckets(d));
  return BENCHMARK_BUCKETS.map((b) => ({
    bucket: b,
    label: BENCHMARK_LABEL[b],
    mine: mine[b],
    bench: bench.pooled[b],
    diff: mine[b] - bench.pooled[b],
    inRange: mine[b] >= bench.range[b].min - 1e-9 && mine[b] <= bench.range[b].max + 1e-9,
  }));
}

const PHRASE: Record<BenchmarkBucket, string> = {
  eagle: 'an eagle or better',
  birdie: 'a birdie',
  par: 'a par',
  bogey: 'a bogey',
  doublePlus: 'a double bogey or worse',
};

/**
 * The one line to lead with: the bucket where you're furthest from scratch RELATIVELY — twice as
 * many doubles (12% vs 6%) outranks a few fewer pars (44% vs 53%), because that's where the
 * strokes go. Only gaps in the costly direction count. Eagles are too rare to headline, and gaps
 * under 2 points aren't worth a headline.
 */
export function headlineGap(c: readonly BucketComparison[]): { bucket: BenchmarkBucket; text: string } | null {
  // Only gaps that cost you: fewer birdies/pars, or more bogeys/doubles, than scratch.
  const worse = (x: BucketComparison) => (x.bucket === 'bogey' || x.bucket === 'doublePlus' ? x.diff > 0 : x.diff < 0);
  const size = (x: BucketComparison) => Math.abs(Math.log(Math.max(x.mine, 1e-3) / x.bench));
  const biggest = c
    .filter((x) => x.bucket !== 'eagle' && x.bench > 0 && Math.abs(x.diff) >= 0.02 && worse(x))
    .reduce<BucketComparison | null>((best, x) => (!best || size(x) > size(best) + 1e-9 ? x : best), null);
  if (!biggest) return null;
  const p = (x: number) => `${Math.round(x * 100)}%`;
  return {
    bucket: biggest.bucket,
    text: `You make ${PHRASE[biggest.bucket]} on ${p(biggest.mine)} of holes; scratch players on ${p(biggest.bench)}.`,
  };
}

/** Strokes to par a hole in each bucket is worth. Double+ counts as exactly +2, so it's a floor. */
const BUCKET_STROKES: Record<BenchmarkBucket, number> = { eagle: -2, birdie: -1, par: 0, bogey: 1, doublePlus: 2 };

export type StrokeGap = { bucket: BenchmarkBucket; label: string; strokesPerRound: number };

/**
 * What each bucket's gap to scratch costs per 18 holes: 18 × (your share − scratch share) × the
 * bucket's strokes to par. Positive = strokes you lose vs scratch. Par is left out — a par is worth
 * 0 to par, so pars you miss show up as the bogeys (and worse) they turned into. Double+ is counted
 * as +2 a hole, so its cost is AT LEAST that. `total` ≈ how far behind scratch you finish per round
 * on hole outcomes alone.
 */
export function strokesPerRound(c: readonly BucketComparison[]): { gaps: StrokeGap[]; total: number } {
  const gaps = c
    .filter((x) => x.bucket !== 'par')
    .map((x) => ({ bucket: x.bucket, label: x.label, strokesPerRound: 18 * x.diff * BUCKET_STROKES[x.bucket] }));
  return { gaps, total: gaps.reduce((a, g) => a + g.strokesPerRound, 0) };
}
